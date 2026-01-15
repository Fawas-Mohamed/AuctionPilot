// src/components/CreateAuctionButton.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button"; // adjust path if needed
import { PlusCircle } from "lucide-react";

export const CreateAuctionButton: React.FC = () => {
  const navigate = useNavigate();
  const handleClick = () => {
    const token = localStorage.getItem("token");
    if (token) navigate("/auctions/create");
    else navigate("/login");
  };

  return (
    <Button onClick={handleClick} variant="gold" className="flex items-center space-x-2">
      <PlusCircle className="h-4 w-4" />
      <span>Create Auction</span>
    </Button>
  );
};

export default CreateAuctionButton;
