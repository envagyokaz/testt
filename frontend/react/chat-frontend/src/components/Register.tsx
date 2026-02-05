import {useState, useEffect} from "react";

export function Register() {
    const [username, setUsername] = useState(""); // NOTE: per user request, this value will be sent as 'email'
    const [password, setPassword] = useState("");
    const [email, setEmail] = useState("");    // NOTE: per user request, this value will be sent as 'username'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (token) {
            // If a token exists, assume logged in and redirect to chat
            window.location.href = "/chat";
        }
    }, []);

    async function handleRegister() {
        setError(null);
        setSuccess(null);

        const trimmedUsername = username.trim();
        const trimmedEmail = email.trim();
        const trimmedPassword = password;

        // Require all fields
        if (!trimmedUsername || !trimmedPassword || !trimmedEmail) {
            setError("Please fill in username, email and password.");
            return;
        }

        // Basic email format check on the "username" field because per mapping username is the email
        const simpleEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!simpleEmailRegex.test(trimmedUsername)) {
            setError("Please enter a valid email in the Username field (per project mapping).");
            return;
        }

        setLoading(true);

        try {
            // Per your mapping: send email: username, username: email
            const body = {
                email: trimmedUsername,
                username: trimmedEmail,
                password: trimmedPassword,
            };

            const response = await fetch("http://10.5.0.50:3000/user/signup", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

            const data = await response.json();
            console.log("Register response:", data);

            if (response.ok) {
                // Do NOT store token or log in automatically. Always redirect to login page.
                setSuccess("Registration successful. Redirecting to login...");
                setTimeout(() => {
                    window.location.href = "/";
                }, 900);
            } else {
                setError(data?.message || "Register failed. Please check your input.");
            }
        } catch (err) {
            console.error("Error during signup:", err);
            setError("Unable to reach authentication server.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <div className="login-box">
                <h1>Register</h1>
                <table>
                    <tbody>
                    <tr>
                        <td>Email:</td>
                        <td>
                            {/* Per your request: the username field actually holds the user's email address. */}
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
                        <td>Username:</td>
                        <td>
                            {/* Per your request: the email field actually holds the user's display username. */}
                            <input
                                type="text"
                                name="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
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
                    {success && (
                        <tr>
                            <td colSpan={2} style={{ color: "#4caf50" }}>
                                {success}
                            </td>
                        </tr>
                    )}
                    <tr>
                        <td colSpan={2}>
                            <button type="button" id={"register-btn"} onClick={handleRegister} disabled={loading}>
                                {loading ? "Registering..." : "Register"}
                            </button>
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={2} style={{ textAlign: "center", paddingTop: 8 }}>
                            <a href="/">Already have an account? Log in</a>
                        </td>
                    </tr>
                    </tbody>
                </table>
            </div>
        </>
    );
}
