import { describe, it, expect } from "vitest";
import {
  calculateHaversineDistance,
  isInsideZone,
  checkNearestZone,
} from "@/lib/geo-utils";

describe("geo-utils", () => {
  describe("calculateHaversineDistance", () => {
    it("harus calculate distance antara dua koordinat", () => {
      // Jakarta Monas ke Bundaran HI (sekitar 1.5 km)
      const distance = calculateHaversineDistance(
        -6.1754,
        106.8272, // Monas
        -6.1951,
        106.8231, // Bundaran HI
      );

      // Distance should be around 2200-2300 meters
      expect(distance).toBeGreaterThan(2000);
      expect(distance).toBeLessThan(2500);
    });

    it("harus return 0 untuk koordinat yang sama", () => {
      const distance = calculateHaversineDistance(
        -6.2088,
        106.8456,
        -6.2088,
        106.8456,
      );

      expect(distance).toBe(0);
    });

    it("harus calculate distance untuk koordinat yang jauh", () => {
      // Jakarta ke Surabaya (sekitar 660 km)
      const distance = calculateHaversineDistance(
        -6.2088,
        106.8456, // Jakarta
        -7.2575,
        112.7521, // Surabaya
      );

      // Distance should be around 660,000 meters
      expect(distance).toBeGreaterThan(650000);
      expect(distance).toBeLessThan(670000);
    });

    it("harus handle koordinat negatif", () => {
      const distance = calculateHaversineDistance(
        -6.2088,
        106.8456,
        -6.2188,
        106.8556,
      );

      expect(distance).toBeGreaterThan(0);
    });

    it("harus calculate distance untuk koordinat di belahan bumi berbeda", () => {
      // Jakarta (selatan) ke Tokyo (utara)
      const distance = calculateHaversineDistance(
        -6.2088,
        106.8456, // Jakarta
        35.6762,
        139.6503, // Tokyo
      );

      // Distance should be around 5,800 km
      expect(distance).toBeGreaterThan(5700000);
      expect(distance).toBeLessThan(5900000);
    });
  });

  describe("isInsideZone", () => {
    it("harus return true jika di dalam zone", () => {
      const result = isInsideZone(
        -6.2088,
        106.8456, // User location
        -6.2088,
        106.8456, // Zone center (same location)
        100, // 100 meter radius
      );

      expect(result).toBe(true);
    });

    it("harus return false jika di luar zone", () => {
      const result = isInsideZone(
        -6.2088,
        106.8456, // User location
        -6.2188,
        106.8556, // Zone center (far away)
        100, // 100 meter radius
      );

      expect(result).toBe(false);
    });

    it("harus return true jika tepat di boundary zone", () => {
      // Create a point exactly 100 meters away
      const result = isInsideZone(
        -6.2088,
        106.8456,
        -6.2088,
        106.8465, // Approximately 100m east
        100,
      );

      expect(result).toBe(true);
    });

    it("harus handle zone dengan radius besar", () => {
      const result = isInsideZone(
        -6.2088,
        106.8456,
        -6.2188,
        106.8556,
        50000, // 50 km radius
      );

      expect(result).toBe(true);
    });

    it("harus handle zone dengan radius kecil", () => {
      const result = isInsideZone(
        -6.2088,
        106.8456,
        -6.2089,
        106.8457, // Very close but outside
        10, // 10 meter radius
      );

      expect(result).toBe(false);
    });
  });

  describe("checkNearestZone", () => {
    it("harus return isInside true untuk empty zones", () => {
      const result = checkNearestZone(-6.2088, 106.8456, []);

      expect(result.isInside).toBe(true);
      expect(result.nearestDistance).toBe(0);
      expect(result.nearestZoneName).toBeNull();
    });

    it("harus find nearest zone dan check if inside", () => {
      const zones = [
        {
          latitude: -6.2088,
          longitude: 106.8456,
          radius: 100,
          name: "Zone A",
        },
        {
          latitude: -6.2188,
          longitude: 106.8556,
          radius: 100,
          name: "Zone B",
        },
      ];

      const result = checkNearestZone(-6.2088, 106.8456, zones);

      expect(result.isInside).toBe(true);
      expect(result.nearestDistance).toBe(0);
      expect(result.nearestZoneName).toBe("Zone A");
    });

    it("harus return nearest zone meskipun tidak inside", () => {
      const zones = [
        {
          latitude: -6.2188,
          longitude: 106.8556,
          radius: 100,
          name: "Zone A",
        },
        {
          latitude: -6.2288,
          longitude: 106.8656,
          radius: 100,
          name: "Zone B",
        },
      ];

      const result = checkNearestZone(-6.2088, 106.8456, zones);

      expect(result.isInside).toBe(false);
      expect(result.nearestZoneName).toBe("Zone A");
      expect(result.nearestDistance).toBeGreaterThan(0);
    });

    it("harus round nearestDistance", () => {
      const zones = [
        {
          latitude: -6.2089,
          longitude: 106.8457,
          radius: 100,
          name: "Zone A",
        },
      ];

      const result = checkNearestZone(-6.2088, 106.8456, zones);

      expect(Number.isInteger(result.nearestDistance)).toBe(true);
    });

    it("harus handle zone tanpa name", () => {
      const zones = [
        {
          latitude: -6.2088,
          longitude: 106.8456,
          radius: 100,
        },
      ];

      const result = checkNearestZone(-6.2088, 106.8456, zones);

      expect(result.isInside).toBe(true);
      expect(result.nearestZoneName).toBeNull();
    });

    it("harus return isInside true jika inside salah satu zone", () => {
      const zones = [
        {
          latitude: -6.2188,
          longitude: 106.8556,
          radius: 100,
          name: "Zone A",
        },
        {
          latitude: -6.2088,
          longitude: 106.8456,
          radius: 100,
          name: "Zone B",
        },
      ];

      const result = checkNearestZone(-6.2088, 106.8456, zones);

      expect(result.isInside).toBe(true);
      expect(result.nearestZoneName).toBe("Zone B");
    });

    it("harus find nearest zone dari multiple zones", () => {
      const zones = [
        {
          latitude: -6.2288,
          longitude: 106.8656,
          radius: 100,
          name: "Zone Far",
        },
        {
          latitude: -6.2188,
          longitude: 106.8556,
          radius: 100,
          name: "Zone Medium",
        },
        {
          latitude: -6.2098,
          longitude: 106.8466,
          radius: 100,
          name: "Zone Near",
        },
      ];

      const result = checkNearestZone(-6.2088, 106.8456, zones);

      expect(result.nearestZoneName).toBe("Zone Near");
    });
  });
});
