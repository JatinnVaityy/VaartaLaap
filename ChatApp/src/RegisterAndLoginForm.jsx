import { useContext, useState } from "react";
import axios from "axios";
import { UserContext } from "./UserContext.jsx";
import toast, { Toaster } from "react-hot-toast";
import { FiUser, FiLock, FiLogIn, FiUserPlus } from "react-icons/fi";

export default function RegisterAndLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoginOrRegister, setIsLoginOrRegister] = useState("login");
  const [loading, setLoading] = useState(false);

  const { setUsername: setLoggedInUsername, setId } = useContext(UserContext);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!username || !password) {
      toast.error("Username and password required");
      return;
    }

    setLoading(true);
    const url = isLoginOrRegister === "register" ? "/register" : "/login";

    try {
      const { data } = await axios.post(
        url,
        { username, password },
        { withCredentials: true }
      );

      setLoggedInUsername(username);
      setId(data.user?.id || data.id);

      toast.success(
        `${
          isLoginOrRegister === "register" ? "Registered" : "Logged in"
        } successfully`
      );

      setUsername("");
      setPassword("");
    } catch (err) {
      console.error(err.response?.data || err);
      toast.error(err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <Toaster position="top-right" />
      <div className="bg-white shadow-xl rounded-2xl w-96 md:w-1/3 overflow-hidden">
        {/* Header */}
        <div className="bg-green-600 text-white p-5 flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            {isLoginOrRegister === "register" ? "Register" : "Login"}
          </h2>
        </div>

        {/* Form */}
        <form className="p-6 space-y-4" onSubmit={handleSubmit}>
          {/* Username */}
          <div className="relative">
            <FiUser className="absolute top-3 left-3 text-gray-400" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <FiLock className="absolute top-3 left-3 text-gray-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 ${
              loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {isLoginOrRegister === "register" ? <FiUserPlus /> : <FiLogIn />}
            {loading
              ? "Please wait..."
              : isLoginOrRegister === "register"
              ? "Register"
              : "Login"}
          </button>

          {/* Switch Auth Mode */}
          <div className="text-center text-gray-500 text-sm">
            {isLoginOrRegister === "register" ? (
              <>
                Already a member?{" "}
                <button
                  type="button"
                  onClick={() => setIsLoginOrRegister("login")}
                  className="text-green-600 font-medium underline"
                >
                  Login here
                </button>
              </>
            ) : (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => setIsLoginOrRegister("register")}
                  className="text-green-600 font-medium underline"
                >
                  Register
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
