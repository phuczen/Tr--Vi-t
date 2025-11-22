
import React, { useState, createContext, useContext, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Language, UserRole, StudentGoal, LibraryItem, ViolationSeverity, User, AdminUser, AdminRole, AdminLog } from './types';
import { LOCALIZATION_STRINGS, STORAGE_LIMIT_BYTES } from './constants';
import { api } from './api'; // Import the new API service
import SplashScreen from './components/SplashScreen';
import MainLayout from './components/MainLayout';
import RoleSelectionScreen from './components/RoleSelectionScreen';
import GoalSelectionScreen from './components/GoalSelectionScreen';
import TermsScreen from './components/TermsScreen';
import AuthScreen from './components/AuthScreen';
import AdminDashboard from './components/AdminDashboard';

interface AppContextType {
  language: Language;
  userRole: UserRole;
  studentGoal: StudentGoal | null;
  t: (key: string) => string;
  handleGoHome: () => void;
  library: LibraryItem[];
  addToLibrary: (item: Omit<LibraryItem, 'id' | 'timestamp'>) => void;
  removeFromLibrary: (id: string) => void;
  libraryUsage: { used: number; total: number };
  handleViolation: (severity?: ViolationSeverity) => void;
  logActivity: (feature: string, activity: string) => void;
}

export const AppContext = createContext<AppContextType | null>(null);

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

const App: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  
  const [language, setLanguage] = useState<Language | null>(null);
  const [hasAgreedToTerms, setHasAgreedToTerms] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [studentGoal, setStudentGoal] = useState<StudentGoal | null>(null);
  
  const [isAccountLocked, setIsAccountLocked] = useState(false);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [lockReason, setLockReason] = useState<string | null>(null);

  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [libraryUsage, setLibraryUsage] = useState({ used: 0, total: STORAGE_LIMIT_BYTES });

  // --- DATA SYNC (Polling / Real-time Simulation) ---
  // FIX: Removed [users, admins] from dependency array to prevent infinite loops.
  useEffect(() => {
      const fetchData = async () => {
          try {
              const latestUsers = await api.getUsers();
              const latestAdmins = await api.getAdmins();

              setUsers(prev => {
                  if (JSON.stringify(prev) !== JSON.stringify(latestUsers)) return latestUsers;
                  return prev;
              });

              setAdmins(prev => {
                   if (JSON.stringify(prev) !== JSON.stringify(latestAdmins)) return latestAdmins;
                   return prev;
              });
          } catch (e) {
              console.error("Polling error", e);
          }
      };

      fetchData(); // Initial Load
      const intervalId = setInterval(fetchData, 2000); // Poll every 2 seconds

      return () => clearInterval(intervalId);
  }, []); // Empty dependency array is crucial here

  // Sync currentUser with updated users list
  useEffect(() => {
      if (currentUser && users.length > 0) {
          const freshUser = users.find(u => u.username === currentUser.username);
          if (freshUser) {
               // Only update if content changed to prevent render loops
               if (JSON.stringify(freshUser) !== JSON.stringify(currentUser)) {
                   setCurrentUser(freshUser);
               }
          } else {
              // User might have been deleted
              setCurrentUser(null);
          }
      }
  }, [users]); // Only run when users list updates

  // Check lock status when currentUser changes
  useEffect(() => {
      if (currentUser) {
          if (currentUser.isDeleted) {
              setCurrentUser(null);
              return;
          }

          if (currentUser.isLocked && currentUser.lockUntil) {
              const now = Date.now();
              if (now < currentUser.lockUntil) {
                  setIsAccountLocked(true);
                  setLockUntil(currentUser.lockUntil);
                  setLockReason(currentUser.lockReason);
              } else {
                  // Auto unlock via API
                  api.updateUser(currentUser.username, { isLocked: false, lockUntil: null, lockReason: null, lockedBy: undefined });
                  setIsAccountLocked(false);
                  setLockUntil(null);
                  setLockReason(null);
              }
          } else {
              setIsAccountLocked(false);
              setLockUntil(null);
              setLockReason(null);
          }
          
          const agreed = localStorage.getItem(`hasAgreedToTerms_${currentUser.username}`) === 'true';
          setHasAgreedToTerms(agreed);
      }
  }, [currentUser]);

  const updateUserState = async (username: string, updates: Partial<User>) => {
      // Optimistic update
      setUsers(prev => prev.map(u => u.username === username ? { ...u, ...updates } : u));
      if (currentUser && currentUser.username === username) {
           setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
      }
      // API Call
      await api.updateUser(username, updates);
  };
  
  const logActivity = (feature: string, activity: string) => {
      if (currentUser) {
          updateUserState(currentUser.username, {
              currentFeature: feature,
              lastActivity: activity,
              lastLogin: Date.now()
          });
      }
  };

  const t = (key: string): string => {
    const lang = language || Language.EN;
    return LOCALIZATION_STRINGS[lang]?.[key] || LOCALIZATION_STRINGS[Language.EN][key] || key;
  };
  
  const getLibraryStorageKey = (): string | null => {
      if (!userRole || !currentUser) return null;
      return `triVietLibrary_${currentUser.username}_${userRole}`;
  }

  useEffect(() => {
    const key = getLibraryStorageKey();
    if (!key) return;
    
    const savedData = localStorage.getItem(key);
    if (savedData) {
        try {
            const items: LibraryItem[] = JSON.parse(savedData);
            setLibrary(items);
            const used = new TextEncoder().encode(savedData).length;
            setLibraryUsage({ used, total: STORAGE_LIMIT_BYTES });
        } catch (e) {
            setLibrary([]);
            setLibraryUsage({ used: 0, total: STORAGE_LIMIT_BYTES });
        }
    } else {
        setLibrary([]);
        setLibraryUsage({ used: 0, total: STORAGE_LIMIT_BYTES });
    }
  }, [userRole, currentUser]);


  const handleLanguageSelect = (selectedLanguage: Language) => {
    setLanguage(selectedLanguage);
  };

  const handleTermsAgreement = () => {
    setHasAgreedToTerms(true);
    if (currentUser) {
        localStorage.setItem(`hasAgreedToTerms_${currentUser.username}`, 'true');
    }
  };

  const handleRoleSelect = (selectedRole: UserRole) => {
    setUserRole(selectedRole);
  };

  const handleGoalSelect = (selectedGoal: StudentGoal) => {
    setStudentGoal(selectedGoal);
  };

  const handleGoHome = () => {
    setLanguage(null);
    setUserRole(null);
    setStudentGoal(null);
  };

  const handleViolation = (severity: ViolationSeverity = 'mild') => {
    if (!currentUser) return;

    const now = Date.now();
    let duration = 0;

    if (severity === 'severe') {
        duration = 30 * 24 * 60 * 60 * 1000; 
    } else {
        duration = 3 * 24 * 60 * 60 * 1000; 
    }

    const unlockTime = now + duration;
    updateUserState(currentUser.username, {
        isLocked: true,
        lockUntil: unlockTime,
        lockReason: severity
    });
  };

  const addToLibrary = (itemData: Omit<LibraryItem, 'id' | 'timestamp'>) => {
      const key = getLibraryStorageKey();
      if (!key) return;

      const newItem: LibraryItem = {
          ...itemData,
          id: `${Date.now()}`,
          timestamp: Date.now(),
      };
      
      const updatedLibrary = [newItem, ...library];
      const newLibraryString = JSON.stringify(updatedLibrary);
      const newSize = new TextEncoder().encode(newLibraryString).length;

      if (newSize > STORAGE_LIMIT_BYTES) {
          alert(t('storage_full'));
          return;
      }
      
      localStorage.setItem(key, newLibraryString);
      setLibrary(updatedLibrary);
      setLibraryUsage({ used: newSize, total: STORAGE_LIMIT_BYTES });
  };

  const removeFromLibrary = (id: string) => {
      const key = getLibraryStorageKey();
      if (!key) return;

      const updatedLibrary = library.filter(item => item.id !== id);
      const newLibraryString = JSON.stringify(updatedLibrary);
      const newSize = new TextEncoder().encode(newLibraryString).length;

      localStorage.setItem(key, newLibraryString);
      setLibrary(updatedLibrary);
      setLibraryUsage({ used: newSize, total: STORAGE_LIMIT_BYTES });
  };

  // --- Authentication Handlers ---

  const handleLogin = async (username: string, pass: string): Promise<boolean> => {
      const currentUsers = await api.getUsers();
      const user = currentUsers.find(u => u.username === username && u.password === pass);
      
      if (user) {
          if (user.isDeleted) return false;
          
          const updatedUser = { ...user, lastLogin: Date.now() };
          await api.updateUser(username, { lastLogin: Date.now() });
          
          // Set local state
          setUsers(prev => prev.map(u => u.username === username ? updatedUser : u));
          setCurrentUser(updatedUser);
          
          // Reset app state
          setLanguage(null);
          setUserRole(null);
          setStudentGoal(null);
          return true;
      }
      return false;
  };

  const handleRegister = async (username: string, pass: string): Promise<boolean> => {
      const success = await api.registerUser(username, pass);
      if (success) {
          // Refresh users list
          const updatedUsers = await api.getUsers();
          setUsers(updatedUsers);
      }
      return success;
  };

  const handleAdminLogin = (username: string, pass: string): boolean => {
      // Admin login logic remains largely client-side based on the fetched admins list for simplicity in this prototype
      const admin = admins.find(a => a.username === username && a.password === pass);
      
      if (admin) {
          // Force refresh users list for admin
          api.getUsers().then(setUsers);

          const newLog: AdminLog = {
              id: Date.now().toString(),
              adminUsername: admin.username,
              action: 'login',
              target: admin.username,
              timestamp: Date.now(),
          };
          
          const updatedAdmins = admins.map(a => 
              a.username === username ? { ...a, lastLogin: Date.now(), logs: [newLog, ...a.logs] } : a
          );
          
          api.saveAdmins(updatedAdmins);
          setAdmins(updatedAdmins);
          setCurrentAdmin(admin);
          return true;
      }
      return false;
  };

  // --- Admin Management Handlers ---
  
  const logAdminAction = (action: AdminLog['action'], target: string, details?: string) => {
      if (!currentAdmin) return;
      
      const newLog: AdminLog = {
          id: Date.now().toString(),
          adminUsername: currentAdmin.username,
          action,
          target,
          timestamp: Date.now(),
          details
      };
      
      const updatedAdmins = admins.map(a => 
          a.username === currentAdmin.username 
          ? { ...a, logs: [newLog, ...a.logs] } 
          : a
      );
      
      api.saveAdmins(updatedAdmins);
      setAdmins(updatedAdmins);
  };

  const handleUpdateAdminCredentials = (username: string, newUsername: string, newPass: string) => {
      if (!currentAdmin || currentAdmin.role !== AdminRole.SUPER_ADMIN) return;

      const updatedAdmins = admins.map(a => {
          if (a.username === username) {
              return { ...a, username: newUsername, password: newPass };
          }
          return a;
      });
      
      api.saveAdmins(updatedAdmins);
      setAdmins(updatedAdmins);
      
      logAdminAction('update_admin', username, `Changed to ${newUsername}`);
      
      if (currentAdmin.username === username) {
          setCurrentAdmin(prev => prev ? { ...prev, username: newUsername, password: newPass } : null);
      }
  };

  const handleCreateAdmin = (username: string, pass: string) => {
      if (!currentAdmin || currentAdmin.role !== AdminRole.SUPER_ADMIN) return;
      if (admins.some(a => a.username === username)) return;

      const newAdmin: AdminUser = {
          username,
          password: pass,
          role: AdminRole.ADMIN,
          lastLogin: 0,
          logs: []
      };
      
      const updatedAdmins = [...admins, newAdmin];
      api.saveAdmins(updatedAdmins);
      setAdmins(updatedAdmins);
      logAdminAction('create_admin', username);
  };

  const handleDeleteAdmin = (username: string) => {
      if (!currentAdmin || currentAdmin.role !== AdminRole.SUPER_ADMIN) return;
      if (username === currentAdmin.username) return;

      const updatedAdmins = admins.filter(a => a.username !== username);
      api.saveAdmins(updatedAdmins);
      setAdmins(updatedAdmins);
      logAdminAction('delete_admin', username);
  };

  // --- Admin Actions on Users ---

  const handleAdminUnlock = (username: string) => {
      updateUserState(username, { isLocked: false, lockUntil: null, lockReason: null, lockedBy: undefined });
      logAdminAction('unlock_user', username);
  };

  const handleAdminLock = (username: string, durationMs: number) => {
      if (!currentAdmin) return;
      updateUserState(username, { 
          isLocked: true, 
          lockUntil: Date.now() + durationMs, 
          lockReason: 'admin_locked',
          lockedBy: currentAdmin.username 
      });
      logAdminAction('lock_user', username, `Duration: ${durationMs / 1000}s`);
  };

  const handleAdminDelete = (username: string) => {
      if (!currentAdmin) return;
      updateUserState(username, { 
          isDeleted: true, 
          deletedBy: currentAdmin.username 
      });
      logAdminAction('delete_user', username);
  };

  const handleAdminRestore = (username: string) => {
      if (!currentAdmin || currentAdmin.role !== AdminRole.SUPER_ADMIN) return;

      updateUserState(username, { 
          isDeleted: false, 
          deletedBy: undefined 
      });
      logAdminAction('restore_user', username);
  };

  if (currentAdmin) {
      return (
          <AdminDashboard 
              currentAdmin={currentAdmin}
              allAdmins={admins}
              users={users}
              onUnlockUser={handleAdminUnlock}
              onLockUser={handleAdminLock}
              onDeleteUser={handleAdminDelete}
              onRestoreUser={handleAdminRestore}
              onUpdateAdminCredentials={handleUpdateAdminCredentials}
              onCreateAdmin={handleCreateAdmin}
              onDeleteAdmin={handleDeleteAdmin}
              onLogout={() => setCurrentAdmin(null)}
              language={Language.VI}
          />
      );
  }

  if (!currentUser) {
      return (
          <AuthScreen 
              onLogin={handleLogin} 
              onRegister={handleRegister} 
              onAdminLogin={handleAdminLogin}
              language={Language.VI}
          />
      );
  }

  // Lock Screen
  if (isAccountLocked) {
      const unlockDate = lockUntil ? new Date(lockUntil).toLocaleString() : '';
      let messageKey = 'account_locked_message'; // Default
      if (lockReason === 'mild') messageKey = 'lock_mild_message';
      if (lockReason === 'severe') messageKey = 'lock_severe_message';

      return (
          <div className="fixed inset-0 bg-slate-900 z-[9999] flex items-center justify-center p-4 text-center">
              <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full border-4 border-red-500">
                  <div className="text-red-500 mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('account_locked_title')}</h2>
                  <p className="text-slate-600 mb-4 text-lg">{t(messageKey)}</p>
                  
                  {lockReason === 'admin_locked' && (
                      <div className="bg-red-50 p-2 rounded mb-4">
                          <p className="text-slate-500 italic">{t('admin_locked')}</p>
                          {currentUser.lockedBy && (
                               <p className="text-red-600 font-semibold">{t('locked_by_admin')} {currentUser.lockedBy}</p>
                          )}
                      </div>
                  )}

                  {unlockDate && (
                      <p className="text-slate-500 text-sm mb-6 font-mono bg-slate-100 p-2 rounded">
                          {t('unlock_at')} <br/>
                          <span className="font-bold text-slate-700">{unlockDate}</span>
                      </p>
                  )}
                  <button onClick={() => window.location.reload()} className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                      {t('contact_support')}
                  </button>
                  <button onClick={() => setCurrentUser(null)} className="block w-full mt-4 text-slate-400 hover:text-slate-600 text-sm">
                      {t('logout')}
                  </button>
              </div>
          </div>
      );
  }

  if (!language) {
    return <SplashScreen onLanguageSelect={handleLanguageSelect} />;
  }

  if (!hasAgreedToTerms) {
      return <TermsScreen onAgree={handleTermsAgreement} language={language} />;
  }
  
  if (!userRole) {
    return <RoleSelectionScreen onRoleSelect={handleRoleSelect} language={language} />;
  }

  if (userRole === UserRole.STUDENT && !studentGoal) {
    return <GoalSelectionScreen onGoalSelect={handleGoalSelect} language={language} />;
  }

  return (
    <AppContext.Provider value={{ language, userRole, studentGoal, t, handleGoHome, library, addToLibrary, removeFromLibrary, libraryUsage, handleViolation, logActivity }}>
      <MainLayout />
    </AppContext.Provider>
  );
};

export default App;
