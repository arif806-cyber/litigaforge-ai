import { useEffect } from "react";
import { useLocation } from "wouter";

export default function UseCases() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/ask"); }, [setLocation]);
  return null;
}
