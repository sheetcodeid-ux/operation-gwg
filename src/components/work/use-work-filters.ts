"use client";

import * as React from "react";

/**
 * Shared Work Tracker filters (month / division / PIC). Kept in local React
 * state so changing a filter is INSTANT — no URL navigation / server round-trip
 * (that made picking a PIC or month feel slow). Each value defaults to "all".
 * Changing the division resets PIC, since the member list differs per division.
 */
export function useWorkFilters(initialDivision = "all") {
  const [month, setMonth] = React.useState("all");
  const [division, setDivisionState] = React.useState(initialDivision);
  const [pic, setPic] = React.useState("all");
  const [category, setCategory] = React.useState("all");

  const setDivision = React.useCallback((v: string) => {
    setDivisionState(v);
    setPic("all");
  }, []);

  return { month, division, pic, category, setMonth, setDivision, setPic, setCategory };
}
