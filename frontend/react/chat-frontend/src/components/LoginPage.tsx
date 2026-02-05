import {useState, useEffect} from "react";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      // If a token exists, assume logged in and redirect to chat
      window.location.href = "/chat";
    }
  }, []);

  async function Login() {
    setError(null);
    if (!username || !password) {
      setError("Please enter username and password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://10.5.0.50:3000/user/signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: username,
          password: password,
        }),
      });

      const data = await response.json();
      console.log("Success:", data);

      if (response.ok && data && data.token) {
        // Store the token and username in localStorage
        localStorage.setItem("token", data.token);
        localStorage.setItem("username", username);
        // Redirect to the chat route
        window.location.href = "/chat";
      } else {
        // Handle auth failure
        setError(data?.message || "Login failed. Please check your credentials.");
      }
    } catch (err) {
      console.error("Error:", err);
      setError("Unable to reach authentication server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="login-box">
        <h1>Login</h1>
        <table>
          <tbody>
            <tr>
              <td>Username:</td>
              <td>
                <input
                  type="text"
                  name="username"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </td>
            </tr>
            <tr>
              <td>Password:</td>
              <td>
                <input
                  type="password"
                  name="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </td>
            </tr>
            {error && (
              <tr>
                <td colSpan={2} style={{ color: "#ff5252" }}>
                  {error}
                </td>
              </tr>
            )}
            <tr>
              <td colSpan={2}>
                <button type="submit" onClick={Login} id={"login-btn"} disabled={loading}>
                  {loading ? "Logging in..." : "Log In"}
                </button>
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ textAlign: "center", paddingTop: 8 }}>
                <a href="/register">Don't have an account? Register</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
