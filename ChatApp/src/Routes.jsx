import { useContext } from "react";
import { UserContext } from "./UserContext.jsx";
import RegisterAndLoginForm from "./RegisterAndLoginForm.jsx";
import Chat from "./Chat.jsx";

export default function Routes() {
  const { username, loading } = useContext(UserContext);

  // Show loading screen while fetching profile
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-green-600"></div>
      </div>
    );
  }

  // If logged in → show Chat
  if (username) {
    return <Chat />;
  }

  // Otherwise → show login/register form
  return <RegisterAndLoginForm />;
}
