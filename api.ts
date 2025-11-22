
import { GoogleGenAI } from "@google/genai";
import { User, AdminUser, AdminRole } from './types';

// Storage Keys
const STORAGE_KEY_USERS = 'triVietUsers';
const STORAGE_KEY_ADMINS = 'triVietAdmins';

// Default Super Admin credentials for initial access
const DEFAULT_ADMIN: AdminUser = {
    username: 'admin',
    password: '123', // In a real app, this should be changed immediately
    role: AdminRole.SUPER_ADMIN,
    lastLogin: 0,
    logs: []
};

// --- Centralized AI Instance ---
const getApiKey = () => {
    let key = '';
    // Try Vite's import.meta.env first (Client-side)
    try {
        // @ts-ignore
        if (import.meta.env?.VITE_API_KEY) {
            // @ts-ignore
            return import.meta.env.VITE_API_KEY;
        }
         // @ts-ignore
        if (import.meta.env?.API_KEY) {
             // @ts-ignore
            return import.meta.env.API_KEY;
        }
    } catch (e) {}

    // Fallback to process.env (Node.js / Defined by Bundler)
    try {
        if (typeof process !== 'undefined' && process.env?.API_KEY) {
            return process.env.API_KEY;
        }
    } catch (e) {}
    
    return key;
};

export const ai = new GoogleGenAI({ apiKey: getApiKey() });

// --- Local Storage Helpers ---

const readLocalUsers = (): User[] => {
    if (typeof window === 'undefined') return [];
    try {
        const savedUsers = localStorage.getItem(STORAGE_KEY_USERS);
        return savedUsers ? JSON.parse(savedUsers) : [];
    } catch (e) {
        console.error("Failed to read users from storage", e);
        return [];
    }
};

const saveLocalUsers = (users: User[]) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    } catch (e) {
        console.error("Failed to save users to storage", e);
    }
};

const readLocalAdmins = (): AdminUser[] => {
    if (typeof window === 'undefined') return [DEFAULT_ADMIN];
    try {
        const savedAdmins = localStorage.getItem(STORAGE_KEY_ADMINS);
        if (savedAdmins) {
            const parsed = JSON.parse(savedAdmins);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch (e) {
        console.error("Failed to read admins from storage", e);
    }
    // Return default admin if none found
    return [DEFAULT_ADMIN];
};

const saveLocalAdmins = (admins: AdminUser[]) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY_ADMINS, JSON.stringify(admins));
    } catch (e) {
        console.error("Failed to save admins to storage", e);
    }
};

// --- User Management API Implementation ---

export const api = {
    /**
     * Fetch all users.
     */
    getUsers: async (): Promise<User[]> => {
        // Minimized latency for better responsiveness
        await new Promise(resolve => setTimeout(resolve, 50));
        return readLocalUsers();
    },

    /**
     * Register a new user.
     * Returns true if successful, false if username exists.
     */
    registerUser: async (username: string, pass: string): Promise<boolean> => {
        await new Promise(resolve => setTimeout(resolve, 100));
        const users = readLocalUsers();
        
        if (users.some(u => u.username === username)) {
            return false;
        }
        
        const newUser: User = {
            username,
            password: pass,
            isLocked: false,
            lockUntil: null,
            lockReason: null,
            createdAt: Date.now(),
            lastLogin: Date.now(),
            currentFeature: 'None',
            lastActivity: 'Registered',
            isDeleted: false
        };
        
        saveLocalUsers([...users, newUser]);
        return true;
    },

    /**
     * Update user data.
     */
    updateUser: async (username: string, updates: Partial<User>): Promise<void> => {
        const users = readLocalUsers();
        const newUsers = users.map(u => u.username === username ? { ...u, ...updates } : u);
        saveLocalUsers(newUsers);
    },

    /**
     * Fetch all admins.
     */
    getAdmins: async (): Promise<AdminUser[]> => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return readLocalAdmins();
    },

    /**
     * Save entire admin list (used for updates, creates, deletes).
     */
    saveAdmins: async (admins: AdminUser[]): Promise<void> => {
         saveLocalAdmins(admins);
    }
};
