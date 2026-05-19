export function CyberBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <div className="absolute inset-0 bg-cyber-grid bg-[length:72px_72px] opacity-15 [mask-image:linear-gradient(to_bottom,black,transparent_76%)]" />
      <div className="absolute inset-0 ai-grid-glow opacity-55" />
      <div className="absolute -left-28 top-20 h-80 w-96 -rotate-12 bg-blue-700/10 blur-3xl" />
      <div className="absolute left-1/2 top-0 h-72 w-[76vw] -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-80 w-80 bg-neon-cyan/8 blur-3xl" />
      <div className="absolute bottom-20 left-0 h-64 w-64 bg-neon-cyan/6 blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-cyan/40 to-transparent" />
    </div>
  );
}
