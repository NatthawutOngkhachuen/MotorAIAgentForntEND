import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Bot, UserPlus } from "lucide-react";
import { CyberBackground } from "@/components/layout/CyberBackground";
import { ErrorState } from "@/components/states/ErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { queryClient } from "@/lib/queryClient";
import { persistAuthSession } from "@/services/authStorage";
import { authService } from "@/services/motoaiService";

export function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [validationError, setValidationError] = useState("");
  const mutation = useMutation({
    mutationFn: authService.register,
    onSuccess: (session) => {
      persistAuthSession(session, username.trim());
      queryClient.clear();
      navigate("/chat");
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmedUsername = username.trim();
    const trimmedName = name.trim();
    const numericAge = Number(age);
    const numericGender = Number(gender);

    if (!trimmedUsername) {
      setValidationError("Username is required.");
      return;
    }
    if (!password) {
      setValidationError("Password is required.");
      return;
    }
    if (confirmPassword !== password) {
      setValidationError("Confirm password must match password.");
      return;
    }
    if (!trimmedName) {
      setValidationError("Name is required.");
      return;
    }
    if (!age || Number.isNaN(numericAge)) {
      setValidationError("Age is required and must be a number.");
      return;
    }
    if (!gender || Number.isNaN(numericGender)) {
      setValidationError("Gender is required.");
      return;
    }

    setValidationError("");
    mutation.mutate({
      username: trimmedUsername,
      password,
      name: trimmedName,
      age: numericAge,
      gender: numericGender,
    });
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
            <p className="text-2xl font-semibold uppercase">MOTOAI AGENT</p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Register</CardTitle>
          </CardHeader>
          <CardContent>
            {validationError ? (
              <div className="mb-4">
                <ErrorState title="Check your registration details" message={validationError} />
              </div>
            ) : null}
            {mutation.isError ? (
              <div className="mb-4">
                <ErrorState message={mutation.error.message} />
              </div>
            ) : null}
            <form className="space-y-4" onSubmit={onSubmit}>
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
              <Input placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} required />
              <Input
                type="number"
                placeholder="Age"
                value={age}
                onChange={(event) => setAge(event.target.value)}
                required
              />
              <select
                className="flex h-11 w-full rounded-md border border-border bg-carbon-950/70 px-3 py-2 text-sm text-foreground shadow-inner outline-none transition placeholder:text-muted-foreground focus:border-neon-cyan/70 focus:ring-2 focus:ring-neon-cyan/20 disabled:cursor-not-allowed disabled:opacity-50"
                value={gender}
                onChange={(event) => setGender(event.target.value)}
                required
              >
                <option value="">Gender</option>
                <option value="1">Male</option>
                <option value="2">Female</option>
              </select>
              <Button className="w-full" type="submit" disabled={mutation.isPending}>
                <UserPlus className="h-4 w-4" />
                {mutation.isPending ? "Creating account..." : "Create account"}
              </Button>
            </form>
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Already registered?{" "}
              <Link className="font-semibold text-neon-cyan hover:underline" to="/login">
                Login
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
