/** Only named durations are exposed. Values are milliseconds, rounded for readable headers. */
export function serverTiming(measures) {
    return Object.entries(measures)
        .filter(([, duration]) => Number.isFinite(duration) && duration >= 0)
        .map(([name, duration]) => `${name};dur=${duration.toFixed(1)}`)
        .join(', ')
}
