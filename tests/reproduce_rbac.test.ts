import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock dependencies BEFORE importing the system under test
vi.mock("@/lib/auth", () => ({
    authConfig: {},
    getUserPermissions: async (userId: string) => {
        if (userId === "user-no-perms") return [];
        if (userId === "user-with-read") return ["users:read"];
        return [];
    },
    isSuperAdmin: (user: any) => user?.role === "SUPER_ADMIN" || user?.isSuperAdmin === true
}))

vi.mock("next-auth", () => ({
    getServerSession: async () => ({
        user: {
            id: "user-no-perms",
            role: "USER"
        }
    })
}))

// Now import the function
import { hasPermission } from "@/lib/rbac"

describe("RBAC Reproduction", () => {
    let logSpy: any;

    beforeEach(() => {
        vi.clearAllMocks();
        // Capture console.log calls
        logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    })

    it("should log [RBAC] Access Denied when user lacks required permission", async () => {
        const userNoPerms = {
            id: "user-no-perms",
            role: "USER"
        }
        
        const result = await hasPermission("users:delete", userNoPerms)
        
        expect(result).toBe(false)
        
        // Check if the log message was captured
        const accessDeniedLog = logSpy.mock.calls.find((call: any[]) => 
            call[0] && typeof call[0] === "string" && call[0].includes("[RBAC] Access Denied")
        );
        
        console.info("Captured Log Message:", accessDeniedLog ? accessDeniedLog[0] : "NOT FOUND");
        expect(accessDeniedLog).toBeDefined()
    })
    
    it("should return true when user has correct permission", async () => {
        const userWithRead = {
            id: "user-with-read",
            role: "USER"
        }
        
        const result = await hasPermission("users:read", userWithRead)
        expect(result).toBe(true)
        
        // Should NOT log Access Denied
        const accessDeniedLog = logSpy.mock.calls.find((call: any[]) => 
            call[0] && typeof call[0] === "string" && call[0].includes("[RBAC] Access Denied")
        );
        expect(accessDeniedLog).toBeUndefined()
    })

    it("should bypass check for Super Admin", async () => {
        const superAdmin = {
            id: "admin-1",
            role: "SUPER_ADMIN"
        }
        
        const result = await hasPermission("any:action", superAdmin)
        expect(result).toBe(true)
        expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining("[RBAC] Access Denied"))
    })
})
