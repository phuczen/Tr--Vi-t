
import { User, AdminUser, AdminRole } from './types';

// --- CẤU HÌNH KẾT NỐI (QUAN TRỌNG) ---

// 1. BẬT CHẾ ĐỘ SERVER:
//    - true: Kết nối với Server (Node.js).
//    - false: Chạy một mình (dùng localStorage).
const USE_BACKEND = false;

// 2. KẾT NỐI INTERNET (DÙNG KHI KHÁC WIFI):
//    Nếu bạn dùng Ngrok hoặc thuê server, hãy dán link vào đây.
//    Ví dụ: const PUBLIC_SERVER_URL = 'https://a1b2-c3d4.ngrok-free.app';
//    Nếu để rỗng '', App sẽ tự động tìm server trong mạng LAN (cùng WiFi).
const PUBLIC_SERVER_URL = '' as string; 

// ---------------------------------------

const getApiUrl = () => {
    // Ưu tiên dùng Link Public nếu người dùng đã điền
    if (PUBLIC_SERVER_URL && PUBLIC_SERVER_URL.trim() !== '') {
        // Xóa dấu / ở cuối nếu có để tránh lỗi
        return PUBLIC_SERVER_URL.replace(/\/$/, '') + '/api';
    }

    // Nếu không có link public, tự động dò tìm trong mạng LAN
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        // Nếu đang chạy trên server thật (không có cổng 3000/5173), thì API thường nằm cùng domain
        if (!window.location.port) {
             return '/api';
        }
        // Mặc định mạng LAN: cổng 3001
        return `http://${hostname}:3001/api`;
    }
    return 'http://localhost:3001/api';
};

const API_URL = getApiUrl();

// --- LOCAL STORAGE HELPERS (Fallback) ---
const readLocalUsers = (): User[] => {
    try {
        const savedUsers = localStorage.getItem('triVietUsers');
        return savedUsers ? JSON.parse(savedUsers) : [];
    } catch (e) { return []; }
};

const saveLocalUsers = (users: User[]) => {
    localStorage.setItem('triVietUsers', JSON.stringify(users));
};

const readLocalAdmins = (): AdminUser[] => {
    try {
        const savedAdmins = localStorage.getItem('triVietAdmins');
        if (savedAdmins) return JSON.parse(savedAdmins);
    } catch (e) {}
    return [{
        username: 'quantriviencaocap',
        password: 'deptrai',
        role: AdminRole.SUPER_ADMIN,
        lastLogin: 0,
        logs: []
    }];
};

const saveLocalAdmins = (admins: AdminUser[]) => {
    localStorage.setItem('triVietAdmins', JSON.stringify(admins));
};

// --- API FUNCTIONS ---

export const api = {
    getUsers: async (): Promise<User[]> => {
        if (USE_BACKEND) {
            try {
                const res = await fetch(`${API_URL}/users`);
                if (res.ok) return await res.json();
            } catch (e) { console.error("Backend fetch failed, falling back to local", e); }
        }
        return readLocalUsers();
    },

    registerUser: async (username: string, pass: string): Promise<boolean> => {
        if (USE_BACKEND) {
            try {
                const res = await fetch(`${API_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password: pass })
                });
                const data = await res.json();
                return data.success;
            } catch (e) { return false; }
        }
        
        // Local Fallback
        const users = readLocalUsers();
        if (users.some(u => u.username === username)) return false;
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

    updateUser: async (username: string, updates: Partial<User>): Promise<void> => {
        if (USE_BACKEND) {
            try {
                await fetch(`${API_URL}/users/update`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, updates })
                });
                return;
            } catch (e) {}
        }

        // Local Fallback
        const users = readLocalUsers();
        const newUsers = users.map(u => u.username === username ? { ...u, ...updates } : u);
        saveLocalUsers(newUsers);
    },

    getAdmins: async (): Promise<AdminUser[]> => {
        if (USE_BACKEND) {
            try {
                const res = await fetch(`${API_URL}/admins`);
                if (res.ok) return await res.json();
            } catch (e) {}
        }
        return readLocalAdmins();
    },

    saveAdmins: async (admins: AdminUser[]): Promise<void> => {
         if (USE_BACKEND) {
             try {
                // Note: In a real backend, you'd have specific endpoints for specific admin actions.
                // This is a simplified sync for the prototype.
                await fetch(`${API_URL}/admins/update`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ admins })
                });
                return;
             } catch(e) {}
         }
         saveLocalAdmins(admins);
    }
};
