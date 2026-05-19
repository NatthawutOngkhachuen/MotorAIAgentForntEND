import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdminDashboardPage } from "@/pages/AdminDashboardPage";
import { ChatPage } from "@/pages/ChatPage";
import { EntitiesPage } from "@/pages/EntitiesPage";
import { KnowledgeGraphPage } from "@/pages/KnowledgeGraphPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { RelationsPage } from "@/pages/RelationsPage";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/chat" replace /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    element: <AppLayout />,
    children: [
      { path: "/chat", element: <ChatPage /> },
      { path: "/admin", element: <AdminDashboardPage /> },
      { path: "/knowledge-graph", element: <KnowledgeGraphPage /> },
      { path: "/entities", element: <EntitiesPage /> },
      { path: "/relations", element: <RelationsPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/chat" replace /> },
]);
