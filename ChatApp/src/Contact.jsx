import Avatar from "./Avatar.jsx";

export default function Contact({ id, username, onClick, selected, online }) {
  return (
    <div
      key={id}
      onClick={() => onClick(id)}
      className={`flex items-center gap-2 cursor-pointer transition-colors duration-200 border-b border-gray-200
        ${selected ? "bg-blue-100" : "hover:bg-gray-100"} 
        p-2 md:p-3 rounded-r-md`}
    >
      {selected && <div className="w-1 bg-blue-500 h-full rounded-r-md"></div>}
      <div className="flex gap-3 items-center flex-1">
        <Avatar online={online} username={username} userId={id} />
        <span className="text-gray-900 font-medium truncate">{username}</span>
      </div>
    </div>
  );
}
