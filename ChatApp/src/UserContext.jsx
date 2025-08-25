import { createContext, useEffect, useState } from "react";
import axios from "axios";

export const UserContext = createContext({});

export function UserContextProvider({ children }) {
  const [username, setUsername] = useState(null);
  const [id, setId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get("/profile", { withCredentials: true })
      .then((res) => {
        setId(res.data.userId);
        setUsername(res.data.username);
      })
      .catch(() => {
        setId(null);
        setUsername(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <UserContext.Provider value={{ username, setUsername, id, setId, loading }}>
      {children}
    </UserContext.Provider>
  );
}
