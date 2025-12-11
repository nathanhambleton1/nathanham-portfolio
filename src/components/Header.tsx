import React from "react";

interface HeaderProps {
  logo: string;
  title: string;
}

const Header: React.FC<HeaderProps> = ({ logo, title }) => (
  <header className="flex items-center gap-4 py-4 px-6 border-b border-border bg-card/40 backdrop-blur-md">
    <img src={logo} alt="Logo" className="h-10 w-10 rounded-lg shadow" />
    <h1 className="text-2xl font-bold text-foreground">{title}</h1>
  </header>
);

export default Header;
