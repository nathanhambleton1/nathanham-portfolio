import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const BackButton = () => {
  const navigate = useNavigate();

  return (
    <Button
      variant="ghost"
      onClick={() => navigate("/")}
      className="mb-6 hover:bg-muted"
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      Games
    </Button>
  );
};
