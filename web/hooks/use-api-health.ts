import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { healthCheck } from "@/lib/api";

export function useApiHealth() {
  const [isMounted, setIsMounted] = useState(false);
  // Sticky: once true, stays true until backend successfully responds
  const [apiDown, setApiDown] = useState(false);
  const hasLoggedStatus = useRef<boolean | null>(null);

  const { isError, isSuccess } = useQuery({
    queryKey: ["api-health"],
    queryFn: healthCheck,
    refetchInterval: 5000,
    retry: false,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    if (isSuccess) {
      // Backend is reachable — clear the banner
      setApiDown(false);
      if (hasLoggedStatus.current !== true) {
        console.log("✅ Backend API detected and healthy");
        hasLoggedStatus.current = true;
      }
    } else if (isError) {
      // Backend is down — latch the banner ON
      setApiDown(true);
      if (hasLoggedStatus.current !== false) {
        console.warn("⚠️ Backend API is unreachable or unhealthy");
        hasLoggedStatus.current = false;
      }
    }
  }, [isSuccess, isError, isMounted]);

  return { apiDown, isMounted };
}
