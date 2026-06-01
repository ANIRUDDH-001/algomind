/**
 * @codesage
 * @file      src/hooks/use-media-query.ts
 * @purpose   React hook to track the state of a CSS media query and update on changes.
 * @tech      React
 * @connects  Exported hook used by React components for responsive UI
 * @apis      none
 * @db        none
 * @state     Local component state for media query match status
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";

export function useMediaQuery(query: string) {
    const [value, setValue] = useState(false);

    useEffect(() => {
        function onChange(event: MediaQueryListEvent) {
            setValue(event.matches);
        }

        const result = window.matchMedia(query);
        result.addEventListener("change", onChange);
        setValue(result.matches);

        return () => result.removeEventListener("change", onChange);
    }, [query]);

    return value;
}
