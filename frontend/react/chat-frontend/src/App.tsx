import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./components/LoginPage.tsx";
import { Chat } from "./components/chat.tsx";
import {Register} from "./components/Register.tsx";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />
          <Route path={"/register"} element={<Register/>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App
