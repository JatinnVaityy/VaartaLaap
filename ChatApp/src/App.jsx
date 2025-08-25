import axios from "axios";
import { UserContextProvider } from "./UserContext.jsx";
import Routes from "./Routes.jsx";

axios.defaults.baseURL = "http://localhost:4040";
axios.defaults.withCredentials = true;

function App() {
  return (
    <UserContextProvider>
      <Routes />
    </UserContextProvider>
  );
}

export default App;
