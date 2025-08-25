export default function Avatar({ userId, username, online }) {
  const colors = [
    "bg-teal-200", "bg-red-200", "bg-green-200",
    "bg-purple-200", "bg-blue-200", "bg-yellow-200",
    "bg-orange-200", "bg-pink-200", "bg-fuchsia-200", "bg-rose-200"
  ];

  // Safe fallback for userId
  let userIdBase10 = 0;
  if (userId) {
    const sub = userId.length > 10 ? userId.substring(10) : userId;
    userIdBase10 = parseInt(sub, 16) || 0;
  }

  const colorIndex = userIdBase10 % colors.length;
  const color = colors[colorIndex];

  // Safe fallback for username
  const initial = username?.[0]?.toUpperCase() || "?";

  return (
    <div className={`w-8 h-8 relative rounded-full flex items-center justify-center ${color}`}>
      <span className="opacity-70">{initial}</span>
      <div
        className={`absolute w-3 h-3 bottom-0 right-0 rounded-full border border-white ${
          online ? "bg-green-400" : "bg-gray-400"
        }`}
      ></div>
    </div>
  );
}
