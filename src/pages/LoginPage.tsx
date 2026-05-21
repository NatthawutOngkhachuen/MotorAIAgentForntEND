import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Bot, LogIn } from "lucide-react";
import { CyberBackground } from "@/components/layout/CyberBackground";
import { ErrorState } from "@/components/states/ErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { queryClient } from "@/lib/queryClient";
import { persistAuthSession } from "@/services/authStorage";
import { authService } from "@/services/motoaiService";

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const mutation = useMutation({
    mutationFn: authService.login,
    onSuccess: (session) => {
      persistAuthSession(session, username.trim());
      queryClient.clear();
      navigate("/chat");
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({ username, password });
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <CyberBackground />
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-md border border-neon-cyan/35 bg-neon-cyan/10 shadow-glow">
            <Bot className="h-7 w-7 text-neon-cyan" />
          </div>
          <div>
            <p className="text-2xl font-semibold uppercase neon-text">MOTOAI AGENT</p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Login</CardTitle>
          </CardHeader>
          <CardContent>
            {mutation.isError ? (
              <div className="mb-4">
                <ErrorState message={mutation.error.message} />
              </div>
            ) : null}
            <form className="space-y-4" onSubmit={onSubmit}>
              <Input type="text" placeholder="Username" value={username} onChange={(event) => setUsername(event.target.value)} required />
              <Input type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              <Button className="w-full" type="submit" disabled={mutation.isPending}>
                <LogIn className="h-4 w-4" />
                {mutation.isPending ? "Signing in..." : "Sign in"}
              </Button>
            </form>
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Need access?{" "}
              <Link className="font-semibold text-neon-cyan hover:underline" to="/register">
                Register
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
