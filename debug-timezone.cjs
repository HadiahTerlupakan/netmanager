
function testTimezone() {
    const serverTime = new Date();
    console.log("Server Time (UTC/Local):", serverTime.toISOString());

    // Simulate 06:18 WIB check-in if server is UTC
    // 06:18 WIB = 23:18 UTC (prev day)
    const simulatedCheckInUTC = new Date();
    simulatedCheckInUTC.setUTCHours(23, 18, 0, 0);
    // If we assume it was yesterday
    simulatedCheckInUTC.setDate(simulatedCheckInUTC.getDate() - 1);

    console.log("Simulated CheckIn (UTC):", simulatedCheckInUTC.toISOString());

    // Convert to Jakarta
    const jakartaTimeStr = simulatedCheckInUTC.toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
    const jakartaTime = new Date(jakartaTimeStr);
    console.log("Jakarta Time String:", jakartaTimeStr);
    console.log("Jakarta Time Object:", jakartaTime.toString());

    // Create Schedule for Today (in Jakarta context)
    // Schedule is 08:00
    const scheduleJakarta = new Date(jakartaTime);
    scheduleJakarta.setHours(8, 0, 0, 0);

    console.log("Schedule Jakarta:", scheduleJakarta.toString());

    // Compare
    if (jakartaTime > scheduleJakarta) {
        console.log("Result: LATE");
    } else {
        console.log("Result: ON_TIME");
    }
}

testTimezone();
