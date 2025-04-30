const express = require("express");
const axios = require("axios");
const githubRouter = express.Router();
const User = require("../models/user");
const { userAuth } = require("../middlewares/auth");

// Initiate GitHub OAuth flow
githubRouter.get("/auth/github", (req, res) => {
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${
    process.env.GITHUB_CLIENT_ID
  }&redirect_uri=${process.env.CLIENT_ORIGIN.replace(
    "5173",
    "7777"
  )}/auth/github/callback&scope=user,repo`;
  res.redirect(githubAuthUrl);
});

// GitHub OAuth callback
githubRouter.get("/auth/github/callback", async (req, res) => {
  try {
    const { code } = req.query;

    // Exchange code for access token
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.CLIENT_ORIGIN.replace(
          "5173",
          "7777"
        )}/auth/github/callback`,
      },
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    const { access_token } = tokenResponse.data;

    // Get user info from GitHub
    const userResponse = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `token ${access_token}`,
      },
    });

    const githubUser = userResponse.data;

    // Check if user already exists with this GitHub ID
    let user = await User.findOne({ githubId: githubUser.id.toString() });

    if (!user) {
      // Check if user exists with this email
      const userEmail = await axios.get("https://api.github.com/user/emails", {
        headers: {
          Authorization: `token ${access_token}`,
        },
      });

      const primaryEmail = userEmail.data.find((email) => email.primary)?.email;

      if (primaryEmail) {
        user = await User.findOne({ emailId: primaryEmail });

        if (user) {
          // Update existing user with GitHub info
          user.githubId = githubUser.id.toString();
          user.githubData = githubUser;
          await user.save();
        } else {
          // Create new user
          user = new User({
            firstName: githubUser.name
              ? githubUser.name.split(" ")[0]
              : githubUser.login,
            lastName: githubUser.name
              ? githubUser.name.split(" ").slice(1).join(" ")
              : "",
            emailId: primaryEmail,
            githubId: githubUser.id.toString(),
            photoUrl: githubUser.avatar_url,
            githubUrl: githubUser.html_url,
            about: githubUser.bio || "Open to make new connections 🙂",
            location: githubUser.location || "",
            githubData: githubUser,
          });

          await user.save();
        }
      }
    }

    // Fetch and update GitHub repos
    await updateGithubRepos(user._id, access_token);

    // Issue JWT
    const token = await user.getJWT();

    // Add token to cookie
    res.cookie("token", token, {
      expires: new Date(Date.now() + 8 * 3600000),
    });

    // Redirect to frontend
    res.redirect(`${process.env.CLIENT_ORIGIN}/profile`);
  } catch (error) {
    console.error("GitHub OAuth Error:", error);
    res.redirect(`${process.env.CLIENT_ORIGIN}/login?error=github_auth_failed`);
  }
});

// Connect GitHub to existing account
githubRouter.get("/connect/github", userAuth, (req, res) => {
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${
    process.env.GITHUB_CLIENT_ID
  }&redirect_uri=${process.env.CLIENT_ORIGIN.replace(
    "5173",
    "7777"
  )}/auth/github/callback/connect&scope=user,repo&state=${req.user._id}`;
  res.redirect(githubAuthUrl);
});

// GitHub connect callback for existing users
githubRouter.get(
  "/auth/github/callback/connect",
  userAuth,
  async (req, res) => {
    try {
      const { code, state } = req.query;

      // Verify state matches user ID
      if (state !== req.user._id.toString()) {
        throw new Error("Invalid state parameter");
      }

      // Exchange code for access token
      const tokenResponse = await axios.post(
        "https://github.com/login/oauth/access_token",
        {
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${process.env.CLIENT_ORIGIN.replace(
            "5173",
            "7777"
          )}/auth/github/callback/connect`,
        },
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      const { access_token } = tokenResponse.data;

      // Get user info from GitHub
      const userResponse = await axios.get("https://api.github.com/user", {
        headers: {
          Authorization: `token ${access_token}`,
        },
      });

      const githubUser = userResponse.data;

      // Update user with GitHub info
      req.user.githubId = githubUser.id.toString();
      req.user.githubUrl = githubUser.html_url;
      req.user.githubData = githubUser;

      // If user doesn't have a profile photo, use GitHub avatar
      if (
        req.user.photoUrl ===
        "https://tamilnaducouncil.ac.in/wp-content/uploads/2020/04/dummy-avatar.jpg"
      ) {
        req.user.photoUrl = githubUser.avatar_url;
      }

      // If user doesn't have a bio, use GitHub bio
      if (
        req.user.about === "Open to make new connections 🙂" &&
        githubUser.bio
      ) {
        req.user.about = githubUser.bio;
      }

      await req.user.save();

      // Fetch and update GitHub repos
      await updateGithubRepos(req.user._id, access_token);

      // Redirect to frontend profile page
      res.redirect(`${process.env.CLIENT_ORIGIN}/profile`);
    } catch (error) {
      console.error("GitHub Connect Error:", error);
      res.redirect(
        `${process.env.CLIENT_ORIGIN}/profile?error=github_connect_failed`
      );
    }
  }
);

// API endpoint to manually refresh GitHub data
githubRouter.post("/github/refresh", userAuth, async (req, res) => {
  try {
    // Make sure user has GitHub connected
    if (!req.user.githubId) {
      return res.status(400).json({ error: "GitHub account not connected" });
    }

    // Get a new access token (Note: In a production app, you'd store and refresh tokens)
    // For simplicity, we're asking user to reconnect if token expired

    // We're assuming we can use the existing githubData
    await updateGithubRepos(req.user._id);

    res.json({ success: true, message: "GitHub data refreshed successfully" });
  } catch (error) {
    console.error("GitHub Refresh Error:", error);
    res.status(500).json({ error: "Failed to refresh GitHub data" });
  }
});

// Get GitHub profile data
githubRouter.get("/github/profile", userAuth, async (req, res) => {
  try {
    if (!req.user.githubId) {
      return res.status(404).json({ error: "GitHub profile not connected" });
    }

    res.json({
      githubData: req.user.githubData,
      githubRepos: req.user.githubRepos,
      githubLanguages: req.user.githubLanguages,
      topRepositories: req.user.topRepositories,
      contributionStats: req.user.contributionStats,
    });
  } catch (error) {
    console.error("Error fetching GitHub profile:", error);
    res.status(500).json({ error: "Failed to fetch GitHub profile data" });
  }
});

// Helper function to update GitHub repos data
async function updateGithubRepos(userId, accessToken = null) {
  try {
    const user = await User.findById(userId);

    if (!user || !user.githubId) {
      throw new Error("User not found or GitHub not connected");
    }

    const headers = accessToken
      ? { Authorization: `token ${accessToken}` }
      : {};

    // Get user's repositories
    const reposResponse = await axios.get(
      `https://api.github.com/users/${user.githubData.login}/repos?sort=updated&per_page=100`,
      {
        headers,
      }
    );

    const repos = reposResponse.data;

    // Extract languages from repos
    const languages = new Set();
    repos.forEach((repo) => {
      if (repo.language) {
        languages.add(repo.language);
      }
    });

    // Find top repositories (by stars)
    const topRepos = [...repos]
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 5)
      .map((repo) => ({
        name: repo.name,
        description: repo.description,
        url: repo.html_url,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        language: repo.language,
      }));

    // Update user's skills based on languages
    const githubLanguagesArray = Array.from(languages);
    user.githubLanguages = githubLanguagesArray;

    // Add languages to skills if not already there
    const updatedSkills = new Set(user.skills || []);
    githubLanguagesArray.forEach((lang) => updatedSkills.add(lang));
    user.skills = Array.from(updatedSkills);

    // Update user's GitHub data
    user.githubRepos = repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      description: repo.description,
      url: repo.html_url,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      language: repo.language,
      created_at: repo.created_at,
      updated_at: repo.updated_at,
    }));

    user.topRepositories = topRepos;

    // Get contribution stats (this is a simplified approach)
    // In a production app, you might want to use the GitHub GraphQL API to get more detailed stats
    const contributionStats = {
      totalRepos: repos.length,
      totalStars: repos.reduce((sum, repo) => sum + repo.stargazers_count, 0),
      totalForks: repos.reduce((sum, repo) => sum + repo.forks_count, 0),
      languages: Object.fromEntries(
        Array.from(languages).map((lang) => [
          lang,
          repos.filter((repo) => repo.language === lang).length,
        ])
      ),
    };

    user.contributionStats = contributionStats;

    // Save updated user
    await user.save();

    return true;
  } catch (error) {
    console.error("Error updating GitHub repos:", error);
    return false;
  }
}

module.exports = githubRouter;
