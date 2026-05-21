import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { HomeRedirect, RequireAuth } from "@/components/routing/AuthRoute";
import { AdminDashboardPage } from "@/pages/AdminDashboardPage";
import { ChatPage } from "@/pages/ChatPage";
import { EntitiesPage } from "@/pages/EntitiesPage";
import { KnowledgeGraphPage } from "@/pages/KnowledgeGraphPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { RelationsPage } from "@/pages/RelationsPage";

export const router = createBrowserRouter([
  { path: "/", element: <HomeRedirect /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { path: "/chat", element: <ChatPage /> },
      { path: "/admin", element: <AdminDashboardPage /> },
      { path: "/knowledge-graph", element: <KnowledgeGraphPage /> },
      { path: "/entities", element: <EntitiesPage /> },
      { path: "/relations", element: <RelationsPage /> },
    ],
  },
  { path: "*", element: <HomeRedirect /> },
]);
