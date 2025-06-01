// Array of vibrant colors for avatars
const colors = [
  "7C3AED", // Purple (brand color)
  "F59E0B", // Amber
  "10B981", // Emerald
  "EC4899", // Pink
  "3B82F6", // Blue
  "EF4444", // Red
  "8B5CF6", // Violet
  "06B6D4", // Cyan
  "F97316", // Orange
  "14B8A6", // Teal
];

const generateInitialsAvatar = (firstName, lastName) => {
  // Get initials
  const firstInitial = firstName ? firstName.charAt(0).toUpperCase() : "";
  const lastInitial = lastName ? lastName.charAt(0).toUpperCase() : "";
  const initials = `${firstInitial}${lastInitial}`;

  // Get random color
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  // Generate UI Avatar URL with initials and random background color
  return `https://ui-avatars.com/api/?name=${initials}&background=${randomColor}&color=fff&bold=true&format=svg`;
};

module.exports = {
  generateInitialsAvatar,
};
