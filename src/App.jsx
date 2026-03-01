import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken
} from 'firebase/auth';
import { doc, getFirestore, onSnapshot, setDoc } from 'firebase/firestore';

const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'food', name: 'Еда', emoji: '🛒', color: 'purple' },
  { id: 'transport', name: 'Транспорт', emoji: '🚕', color: 'blue' },
  { id: 'shopping', name: 'Покупки', emoji: '🛍️', color: 'pink' },
  { id: 'home', name: 'Дом', emoji: '🏠', color: 'yellow' },
  { id: 'health', name: 'Здоровье', emoji: '❤️', color: 'red' },
  { id: 'sport', name: 'Спорт', emoji: '🚴', color: 'green' },
  { id: 'coffee', name: 'Кафе', emoji: '☕', color: 'orange' }
];

const DEFAULT_INCOME_CATEGORIES = [
  { id: 'salary', name: 'Зарплата', emoji: '💰', color: 'green' },
  { id: 'freelance', name: 'Фриланс', emoji: '👨‍💻', color: 'blue' },
  { id: 'gift', name: 'Подарок', emoji: '🎁', color: 'pink' },
  { id: 'invest', name: 'Инвестиции', emoji: '📈', color: 'purple' }
];

const parseMaybeJson = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const readStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const normalizeTransactions = (items) =>
  (Array.isArray(items) ? items : []).map((tx) => {
    const date = tx?.date instanceof Date ? tx.date : new Date(tx?.date);
    return {
      ...tx,
      date: Number.isNaN(date.getTime()) ? new Date() : date
    };
  });

const FIREBASE_CONFIG =
  parseMaybeJson(import.meta.env.VITE_FIREBASE_CONFIG) ||
  parseMaybeJson(typeof window !== 'undefined' ? window.__firebase_config : null);

const APP_ID =
  import.meta.env.VITE_APP_ID ||
  (typeof window !== 'undefined' && window.__app_id) ||
  'finance-tracker';

const INITIAL_AUTH_TOKEN =
  (typeof window !== 'undefined' && window.__initial_auth_token) || null;

const IconWrapper = ({ children, size = 24, strokeWidth = 2, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

const Icons = {
  Plus: (p) => (
    <IconWrapper {...p}>
      <path d="M12 5v14M5 12h14" />
    </IconWrapper>
  ),
  Search: (p) => (
    <IconWrapper {...p}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </IconWrapper>
  ),
  ChevronRight: (p) => (
    <IconWrapper {...p}>
      <path d="m9 18 6-6-6-6" />
    </IconWrapper>
  ),
  ArrowLeft: (p) => (
    <IconWrapper {...p}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </IconWrapper>
  ),
  ArrowDown: (p) => (
    <IconWrapper {...p}>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </IconWrapper>
  ),
  ArrowUp: (p) => (
    <IconWrapper {...p}>
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </IconWrapper>
  ),
  Calendar: (p) => (
    <IconWrapper {...p}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </IconWrapper>
  ),
  Trash2: (p) => (
    <IconWrapper {...p}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </IconWrapper>
  ),
  LayoutGrid: (p) => (
    <IconWrapper {...p}>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </IconWrapper>
  ),
  X: (p) => (
    <IconWrapper {...p}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </IconWrapper>
  ),
  Target: (p) => (
    <IconWrapper {...p}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </IconWrapper>
  ),
  Pencil: (p) => (
    <IconWrapper {...p}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </IconWrapper>
  ),
  Settings: (p) => (
    <IconWrapper {...p}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </IconWrapper>
  ),
  Download: (p) => (
    <IconWrapper {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </IconWrapper>
  ),
  Upload: (p) => (
    <IconWrapper {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </IconWrapper>
  ),
  List: (p) => (
    <IconWrapper {...p}>
      <line x1="8" x2="21" y1="6" y2="6" />
      <line x1="8" x2="21" y1="12" y2="12" />
      <line x1="8" x2="21" y1="18" y2="18" />
      <line x1="3" x2="3.01" y1="6" y2="6" />
      <line x1="3" x2="3.01" y1="12" y2="12" />
      <line x1="3" x2="3.01" y1="18" y2="18" />
    </IconWrapper>
  ),
  AlertCircle: (p) => (
    <IconWrapper {...p}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </IconWrapper>
  ),
  PieChart: (p) => (
    <IconWrapper {...p}>
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </IconWrapper>
  ),
  BarChart3: (p) => (
    <IconWrapper {...p}>
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </IconWrapper>
  ),
  ListOrdered: (p) => (
    <IconWrapper {...p}>
      <path d="M10 6h11" />
      <path d="M10 12h11" />
      <path d="M10 18h11" />
      <path d="M4 6h1v4" />
      <path d="M4 10h2" />
      <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
    </IconWrapper>
  ),
  Cloud: (p) => (
    <IconWrapper {...p}>
      <path d="M17.5 19A4.5 4.5 0 0 0 18 10h-.5a7.1 7.1 0 0 0-14 1.5A3.5 3.5 0 0 0 5.5 19H17.5Z" />
    </IconWrapper>
  ),
  CloudOff: (p) => (
    <IconWrapper {...p}>
      <path d="m2 2 20 20" />
      <path d="M22 17.5c0 1.2-.5 2.3-1.4 3M6 19H3.5a3.5 3.5 0 0 1-2.4-5.9" />
      <path d="M5.4 9.4A7.1 7.1 0 0 1 17.5 10h.5a4.5 4.5 0 0 1 3.5 7.6" />
    </IconWrapper>
  )
};

const {
  Plus,
  Search,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Calendar,
  Trash2,
  LayoutGrid,
  X,
  Target,
  Pencil,
  Settings,
  Download,
  Upload,
  List: ListIcon,
  AlertCircle,
  PieChart,
  BarChart3,
  ListOrdered,
  Cloud,
  CloudOff,
  ChevronRight
} = Icons;

const getHexColor = (colorName) => {
  const colors = {
    purple: '#a855f7',
    blue: '#3b82f6',
    pink: '#ec4899',
    yellow: '#eab308',
    red: '#ef4444',
    green: '#22c55e',
    orange: '#fb923c',
    slate: '#64748b'
  };
  return colors[colorName] || colors.slate;
};

const getColorStyles = (colorName) => {
  const styles = {
    purple: {
      bar: 'bg-purple-500',
      soft: 'bg-purple-500/20',
      text: 'text-purple-400',
      border: 'border-purple-500'
    },
    blue: {
      bar: 'bg-blue-500',
      soft: 'bg-blue-500/20',
      text: 'text-blue-400',
      border: 'border-blue-500'
    },
    pink: {
      bar: 'bg-pink-500',
      soft: 'bg-pink-500/20',
      text: 'text-pink-400',
      border: 'border-pink-500'
    },
    yellow: {
      bar: 'bg-yellow-500',
      soft: 'bg-yellow-500/20',
      text: 'text-yellow-400',
      border: 'border-yellow-500'
    },
    red: {
      bar: 'bg-red-500',
      soft: 'bg-red-500/20',
      text: 'text-red-400',
      border: 'border-red-500'
    },
    green: {
      bar: 'bg-green-500',
      soft: 'bg-green-500/20',
      text: 'text-green-400',
      border: 'border-green-500'
    },
    orange: {
      bar: 'bg-orange-400',
      soft: 'bg-orange-500/20',
      text: 'text-orange-400',
      border: 'border-orange-400'
    },
    slate: {
      bar: 'bg-slate-500',
      soft: 'bg-slate-500/20',
      text: 'text-slate-400',
      border: 'border-slate-500'
    }
  };
  return styles[colorName] || styles.slate;
};

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [editingTx, setEditingTx] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [categoryFormType, setCategoryFormType] = useState('expense');
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);
  const [editingGoalData, setEditingGoalData] = useState(null);
  const [isEditBalanceOpen, setIsEditBalanceOpen] = useState(false);

  const [cloudStatus, setCloudStatus] = useState(FIREBASE_CONFIG ? 'loading' : 'local');

  const [expenseCategories, setExpenseCategories] = useState(() =>
    readStorage('finance_expense_categories', DEFAULT_EXPENSE_CATEGORIES)
  );
  const [incomeCategories, setIncomeCategories] = useState(() =>
    readStorage('finance_income_categories', DEFAULT_INCOME_CATEGORIES)
  );
  const [accounts, setAccounts] = useState(() =>
    readStorage('finance_accounts', [
      {
        id: 'main',
        name: 'Основной счет',
        balance: 0,
        type: 'card',
        color: 'bg-yellow-500'
      }
    ])
  );
  const [goals, setGoals] = useState(() => readStorage('finance_goals', []));
  const [transactions, setTransactions] = useState(() =>
    normalizeTransactions(readStorage('finance_transactions', []))
  );

  const stateRef = useRef({
    transactions,
    goals,
    accounts,
    expenseCategories,
    incomeCategories
  });

  const cloudRef = useRef({
    db: null,
    user: null,
    unsubscribeDoc: null,
    unsubscribeAuth: null
  });

  useEffect(() => {
    stateRef.current = {
      transactions,
      goals,
      accounts,
      expenseCategories,
      incomeCategories
    };
  }, [transactions, goals, accounts, expenseCategories, incomeCategories]);

  useEffect(() => {
    localStorage.setItem('finance_accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem('finance_goals', JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    localStorage.setItem('finance_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('finance_expense_categories', JSON.stringify(expenseCategories));
  }, [expenseCategories]);

  useEffect(() => {
    localStorage.setItem('finance_income_categories', JSON.stringify(incomeCategories));
  }, [incomeCategories]);

  useEffect(() => {
    if (!FIREBASE_CONFIG) {
      setCloudStatus('local');
      return undefined;
    }

    let isMounted = true;

    const initFirebase = async () => {
      try {
        const app = initializeApp(FIREBASE_CONFIG);
        const auth = getAuth(app);
        const db = getFirestore(app);

        cloudRef.current.db = db;

        if (INITIAL_AUTH_TOKEN) {
          await signInWithCustomToken(auth, INITIAL_AUTH_TOKEN);
        } else {
          await signInAnonymously(auth);
        }

        cloudRef.current.unsubscribeAuth = onAuthStateChanged(auth, (user) => {
          if (!isMounted || !user) return;

          cloudRef.current.user = user;
          const docRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'appData', 'state');

          if (cloudRef.current.unsubscribeDoc) {
            cloudRef.current.unsubscribeDoc();
          }

          cloudRef.current.unsubscribeDoc = onSnapshot(
            docRef,
            (docSnap) => {
              if (!isMounted) return;
              if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.transactions) {
                  setTransactions(normalizeTransactions(data.transactions));
                }
                if (data.accounts) setAccounts(data.accounts);
                if (data.goals) setGoals(data.goals);
                if (data.expenseCategories) setExpenseCategories(data.expenseCategories);
                if (data.incomeCategories) setIncomeCategories(data.incomeCategories);
              }
              setCloudStatus('synced');
            },
            (error) => {
              console.error('Firebase Sync Error', error);
              if (isMounted) setCloudStatus('error');
            }
          );
        });
      } catch (error) {
        console.error('Firebase init error', error);
        if (isMounted) setCloudStatus('error');
      }
    };

    initFirebase();

    return () => {
      isMounted = false;
      if (cloudRef.current.unsubscribeDoc) cloudRef.current.unsubscribeDoc();
      if (cloudRef.current.unsubscribeAuth) cloudRef.current.unsubscribeAuth();
    };
  }, []);

  const updateStateAndCloud = useCallback((updates) => {
    const nextState = {
      ...stateRef.current,
      ...updates
    };

    if (updates.transactions) setTransactions(nextState.transactions);
    if (updates.accounts) setAccounts(nextState.accounts);
    if (updates.goals) setGoals(nextState.goals);
    if (updates.expenseCategories) setExpenseCategories(nextState.expenseCategories);
    if (updates.incomeCategories) setIncomeCategories(nextState.incomeCategories);

    stateRef.current = nextState;

    if (cloudRef.current.db && cloudRef.current.user) {
      const docRef = doc(
        cloudRef.current.db,
        'artifacts',
        APP_ID,
        'users',
        cloudRef.current.user.uid,
        'appData',
        'state'
      );

      const payload = {
        transactions: (nextState.transactions || []).map((tx) => ({
          ...tx,
          date: tx.date.toISOString()
        })),
        accounts: nextState.accounts || [],
        goals: nextState.goals || [],
        expenseCategories: nextState.expenseCategories || [],
        incomeCategories: nextState.incomeCategories || []
      };

      setDoc(docRef, payload).catch((error) => {
        console.error('Upload error', error);
        setCloudStatus('error');
      });
    }
  }, []);

  const totalBalance = useMemo(
    () => accounts.reduce((acc, account) => acc + account.balance, 0),
    [accounts]
  );

  const currentMonthStats = useMemo(() => {
    const now = new Date();
    const currentMonthTx = transactions.filter(
      (tx) =>
        tx.date.getMonth() === now.getMonth() &&
        tx.date.getFullYear() === now.getFullYear()
    );
    const expenseTotal = currentMonthTx
      .filter((tx) => tx.type === 'expense')
      .reduce((acc, tx) => acc + tx.amount, 0);
    const incomeTotal = currentMonthTx
      .filter((tx) => tx.type === 'income')
      .reduce((acc, tx) => acc + tx.amount, 0);
    const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    const shortMonthName = monthNames[now.getMonth()];

    return {
      monthName: now.toLocaleString('ru-RU', { month: 'long' }),
      shortMonthName,
      expenseTotal,
      incomeTotal
    };
  }, [transactions]);

  const currentMonthCategoryStats = useMemo(() => {
    const now = new Date();
    const stats = {};

    transactions
      .filter(
        (tx) =>
          tx.type === 'expense' &&
          tx.date.getMonth() === now.getMonth() &&
          tx.date.getFullYear() === now.getFullYear()
      )
      .forEach((tx) => {
        if (!stats[tx.categoryId]) {
          stats[tx.categoryId] = { categoryId: tx.categoryId, amount: 0, count: 0 };
        }
        stats[tx.categoryId].amount += tx.amount;
        stats[tx.categoryId].count += 1;
      });

    return Object.values(stats)
      .sort((a, b) => b.amount - a.amount)
      .filter((stat) => {
        const cat = expenseCategories.find((c) => c.id === stat.categoryId);
        const matchesSearch =
          !searchQuery ||
          (cat
            ? cat.name.toLowerCase().includes(searchQuery.toLowerCase())
            : 'архив'.includes(searchQuery.toLowerCase()));
        return matchesSearch;
      });
  }, [transactions, searchQuery, expenseCategories]);

  const handleSaveTransaction = (data) => {
    const { amount, type, categoryId, comment } = data;
    const numAmount = parseFloat(amount);
    if (Number.isNaN(numAmount) || numAmount <= 0) return;

    if (editingTx) {
      const newAccounts = accounts.map((acc) => {
        if (acc.id !== editingTx.accountId) return acc;

        let newBalance = acc.balance;
        newBalance = editingTx.type === 'expense' ? newBalance + editingTx.amount : newBalance - editingTx.amount;
        newBalance = type === 'expense' ? newBalance - numAmount : newBalance + numAmount;
        return { ...acc, balance: newBalance };
      });

      const newTransactions = transactions.map((tx) =>
        tx.id === editingTx.id
          ? { ...tx, amount: numAmount, type, categoryId: categoryId || null, comment }
          : tx
      );

      updateStateAndCloud({ accounts: newAccounts, transactions: newTransactions });
      setEditingTx(null);
      return;
    }

    const newTx = {
      id: Date.now(),
      date: new Date(),
      amount: numAmount,
      type,
      comment,
      accountId: 'main',
      categoryId: categoryId || null
    };

    const newAccounts = accounts.map((acc) => {
      if (acc.id !== 'main') return acc;
      return {
        ...acc,
        balance: type === 'expense' ? acc.balance - numAmount : acc.balance + numAmount
      };
    });

    updateStateAndCloud({ accounts: newAccounts, transactions: [newTx, ...transactions] });
    setIsAdding(false);
  };

  const handleDeleteTransaction = (tx) => {
    const newAccounts = accounts.map((acc) => {
      if (acc.id !== tx.accountId) return acc;
      return {
        ...acc,
        balance: tx.type === 'expense' ? acc.balance + tx.amount : acc.balance - tx.amount
      };
    });

    const newTransactions = transactions.filter((item) => item.id !== tx.id);
    updateStateAndCloud({ accounts: newAccounts, transactions: newTransactions });
  };

  const handleUpdateBalance = (newBalance) => {
    const numeric = Number.parseFloat(newBalance);
    if (Number.isNaN(numeric)) return;

    const newAccounts = accounts.map((acc) =>
      acc.id === 'main' ? { ...acc, balance: numeric } : acc
    );

    updateStateAndCloud({ accounts: newAccounts });
    setIsEditBalanceOpen(false);
  };

  const handleOpenCategoryForm = (type) => {
    setCategoryFormType(type);
    setIsCategoryFormOpen(true);
  };

  const handleSaveCategory = (data) => {
    const newCategory = { id: Date.now().toString(), ...data };

    if (categoryFormType === 'expense') {
      updateStateAndCloud({ expenseCategories: [...expenseCategories, newCategory] });
    } else {
      updateStateAndCloud({ incomeCategories: [...incomeCategories, newCategory] });
    }

    setIsCategoryFormOpen(false);
  };

  const handleDeleteCategory = (id, type) => {
    if (type === 'expense') {
      updateStateAndCloud({ expenseCategories: expenseCategories.filter((cat) => cat.id !== id) });
      return;
    }
    updateStateAndCloud({ incomeCategories: incomeCategories.filter((cat) => cat.id !== id) });
  };

  const openCreateGoal = () => {
    setEditingGoalData(null);
    setIsGoalFormOpen(true);
  };

  const openEditGoal = (goal) => {
    setEditingGoalData(goal);
    setIsGoalFormOpen(true);
    setSelectedGoal(null);
  };

  const handleSaveGoal = (goalData) => {
    let newGoals;

    if (editingGoalData) {
      newGoals = goals.map((goal) =>
        goal.id === editingGoalData.id ? { ...goal, ...goalData } : goal
      );
    } else {
      newGoals = [...goals, { id: Date.now(), current: 0, ...goalData }];
    }

    updateStateAndCloud({ goals: newGoals });
    setIsGoalFormOpen(false);
    setEditingGoalData(null);
  };

  const handleTopUpGoal = (goalId, amount) => {
    const numAmount = parseFloat(amount);
    if (Number.isNaN(numAmount) || numAmount <= 0) return;

    const newGoals = goals.map((goal) =>
      goal.id === goalId ? { ...goal, current: goal.current + numAmount } : goal
    );

    const newAccounts = accounts.map((acc) =>
      acc.id === 'main' ? { ...acc, balance: acc.balance - numAmount } : acc
    );

    updateStateAndCloud({ goals: newGoals, accounts: newAccounts });
    setSelectedGoal(null);
  };

  const handleExportData = () => {
    const data = { transactions, goals, accounts, expenseCategories, incomeCategories };
    const link = document.createElement('a');
    link.href = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data))}`;
    link.download = 'finance_backup.json';
    link.click();
  };

  const handleImportData = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsText(file, 'UTF-8');
    reader.onload = (loadEvent) => {
      try {
        const data = JSON.parse(loadEvent.target.result);
        const updates = {};

        if (data.transactions) updates.transactions = normalizeTransactions(data.transactions);
        if (data.goals) updates.goals = data.goals;
        if (data.accounts) updates.accounts = data.accounts;
        if (data.expenseCategories) updates.expenseCategories = data.expenseCategories;
        if (data.incomeCategories) updates.incomeCategories = data.incomeCategories;

        updateStateAndCloud(updates);
        setIsSettingsOpen(false);
      } catch (error) {
        console.error('Error parsing backup file', error);
      }
    };

    event.target.value = '';
  };

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-[#09090b] text-white shadow-2xl">
      {selectedCategory ? (
        <CategoryDetailView
          categoryId={selectedCategory}
          category={expenseCategories.find((cat) => cat.id === selectedCategory)}
          transactions={transactions}
          onBack={() => setSelectedCategory(null)}
          onDeleteTx={handleDeleteTransaction}
          onEditTx={setEditingTx}
        />
      ) : (
        <>
          {activeTab === 'home' && (
            <HomeView
              balance={totalBalance}
              currentMonthStats={currentMonthStats}
              categoryStats={currentMonthCategoryStats}
              expenseCategories={expenseCategories}
              goals={goals}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              openCreateGoal={openCreateGoal}
              setSelectedGoal={setSelectedGoal}
              setSelectedCategory={setSelectedCategory}
              onEditBalance={() => setIsEditBalanceOpen(true)}
              openSettings={() => setIsSettingsOpen(true)}
              cloudStatus={cloudStatus}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              transactions={transactions}
              expenseCategories={expenseCategories}
              incomeCategories={incomeCategories}
              setSelectedCategory={setSelectedCategory}
              onDeleteTx={handleDeleteTransaction}
              onEditTx={setEditingTx}
            />
          )}

          <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} onAdd={() => setIsAdding(true)} />
        </>
      )}

      {(isAdding || editingTx) && (
        <AddTransactionSheet
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          initialData={editingTx}
          onClose={() => {
            setIsAdding(false);
            setEditingTx(null);
          }}
          onSave={handleSaveTransaction}
        />
      )}

      {selectedGoal && (
        <GoalDetailSheet
          goal={selectedGoal}
          onClose={() => setSelectedGoal(null)}
          onTopUp={(amount) => handleTopUpGoal(selectedGoal.id, amount)}
          onEdit={() => openEditGoal(selectedGoal)}
          onDelete={() => {
            const newGoals = goals.filter((goal) => goal.id !== selectedGoal.id);
            updateStateAndCloud({ goals: newGoals });
            setSelectedGoal(null);
          }}
        />
      )}

      {isGoalFormOpen && (
        <GoalFormSheet
          initialData={editingGoalData}
          onClose={() => setIsGoalFormOpen(false)}
          onSave={handleSaveGoal}
        />
      )}

      {isSettingsOpen && (
        <SettingsSheet
          onClose={() => setIsSettingsOpen(false)}
          onExport={handleExportData}
          onImport={handleImportData}
          onManageCategories={() => {
            setIsSettingsOpen(false);
            setIsManageCategoriesOpen(true);
          }}
          cloudStatus={cloudStatus}
        />
      )}

      {isManageCategoriesOpen && (
        <ManageCategoriesSheet
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          onClose={() => setIsManageCategoriesOpen(false)}
          onDelete={handleDeleteCategory}
          onAdd={handleOpenCategoryForm}
        />
      )}

      {isCategoryFormOpen && (
        <CategoryFormSheet
          type={categoryFormType}
          onClose={() => setIsCategoryFormOpen(false)}
          onSave={handleSaveCategory}
        />
      )}

      {isEditBalanceOpen && (
        <EditBalanceSheet
          currentBalance={totalBalance}
          onClose={() => setIsEditBalanceOpen(false)}
          onSave={handleUpdateBalance}
        />
      )}
    </div>
  );
}

const HomeView = ({
  balance,
  currentMonthStats,
  categoryStats,
  expenseCategories,
  goals,
  searchQuery,
  setSearchQuery,
  openCreateGoal,
  setSelectedGoal,
  setSelectedCategory,
  onEditBalance,
  openSettings,
  cloudStatus
}) => (
  <>
    <div className="z-10 mt-4 flex-none space-y-4 bg-[#09090b]/95 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md">
      <div className="flex w-full gap-2">
        <div className="group relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Поиск транзакций..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-2xl bg-[#1c1c1e] py-3.5 pl-12 pr-4 text-[16px] font-medium text-slate-200 shadow-sm placeholder:text-slate-500 transition-all focus:outline-none focus:ring-1 focus:ring-slate-600"
          />
        </div>

        <button
          onClick={openSettings}
          className="relative flex h-[52px] w-[52px] items-center justify-center rounded-2xl border border-transparent bg-[#1c1c1e] text-slate-400 shadow-sm transition-colors hover:border-white/5 hover:text-white"
        >
          <Settings size={22} />
          {cloudStatus === 'synced' && (
            <div className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full border-2 border-[#1c1c1e] bg-green-500" />
          )}
          {cloudStatus === 'error' && (
            <div className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full border-2 border-[#1c1c1e] bg-red-500" />
          )}
        </button>
      </div>
    </div>

    <div className="scrollbar-hide flex-1 overflow-y-auto px-4 pb-32 pt-2">
      {!searchQuery && (
        <>
          <div className="group relative mb-6 px-1">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[15px] font-medium text-slate-400">Доступный остаток</span>
              <div
                onClick={onEditBalance}
                className="cursor-pointer rounded-full bg-[#2c2c2e] p-2 transition-colors hover:bg-[#5856D6]/20"
              >
                <Pencil size={14} className="text-[#5856D6]" />
              </div>
            </div>
            <h2 className="mb-3 text-[42px] font-bold tracking-tight text-white">
              ₽ {balance.toLocaleString('ru-RU')}
            </h2>
          </div>

          <div className="mb-8 flex gap-3">
            <div className="group relative flex-1 overflow-hidden rounded-[20px] border border-white/5 bg-[#1c1c1e] p-4 shadow-lg transition-colors hover:border-green-500/30">
              <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-green-500/5 blur-xl transition-all group-hover:bg-green-500/10" />
              <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-green-500/10">
                <ArrowDown className="text-green-500" size={18} strokeWidth={2.5} />
              </div>
              <p className="mb-1 text-[11px] font-semibold text-slate-400">
                Доходы ({currentMonthStats.shortMonthName})
              </p>
              <p className="text-lg font-bold tracking-wide text-white">
                ₽ {currentMonthStats.incomeTotal.toLocaleString('ru-RU')}
              </p>
            </div>

            <div className="group relative flex-1 overflow-hidden rounded-[20px] border border-white/5 bg-[#1c1c1e] p-4 shadow-lg transition-colors hover:border-red-500/30">
              <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-red-500/5 blur-xl transition-all group-hover:bg-red-500/10" />
              <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-red-500/10">
                <ArrowUp className="text-red-500" size={18} strokeWidth={2.5} />
              </div>
              <p className="mb-1 text-[11px] font-semibold text-slate-400">
                Расходы ({currentMonthStats.shortMonthName})
              </p>
              <p className="text-lg font-bold tracking-wide text-white">
                ₽ {currentMonthStats.expenseTotal.toLocaleString('ru-RU')}
              </p>
            </div>
          </div>

          <div className="mb-8">
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Target size={14} /> Мои цели
              </h3>
              {goals.length > 0 && <button className="text-xs font-bold text-[#5856D6]">Все</button>}
            </div>

            {goals.length === 0 ? (
              <button
                onClick={openCreateGoal}
                className="group flex w-full flex-col items-center justify-center gap-3 rounded-[24px] border-2 border-dashed border-white/10 bg-[#1c1c1e] p-6 transition-colors hover:bg-[#252527]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#5856D6]/20 transition-transform group-hover:scale-110">
                  <Plus className="text-[#5856D6]" size={24} />
                </div>
                <span className="font-medium text-slate-400">Создать первую цель</span>
              </button>
            ) : (
              <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 pb-4">
                {goals.map((goal) => {
                  const percent = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
                  return (
                    <div
                      key={goal.id}
                      onClick={() => setSelectedGoal(goal)}
                      className="group relative min-w-[160px] overflow-hidden rounded-[24px] border border-white/5 bg-[#1c1c1e] p-4 shadow-lg transition-transform active:scale-95"
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <span className="text-2xl">{goal.emoji}</span>
                        <div className="relative flex h-10 w-10 items-center justify-center">
                          <CircleProgress percentage={percent} color={goal.color} size={40} strokeWidth={4} />
                          <span className="absolute text-[10px] font-bold text-white">{percent}%</span>
                        </div>
                      </div>
                      <div>
                        <p className="mb-0.5 truncate text-sm font-bold text-white">{goal.name}</p>
                        <p className="text-[10px] font-medium text-slate-500">
                          {goal.current >= 1000 ? `${(goal.current / 1000).toFixed(0)}k` : goal.current} /{' '}
                          {(goal.target / 1000).toFixed(0)}k ₽
                        </p>
                      </div>
                    </div>
                  );
                })}
                <button
                  onClick={openCreateGoal}
                  className="flex min-w-[60px] items-center justify-center rounded-[24px] border border-dashed border-white/5 bg-[#1c1c1e]/30 transition-colors hover:bg-[#1c1c1e]/50"
                >
                  <Plus className="text-slate-600" />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <h3 className="mb-4 pl-1 text-sm font-bold uppercase tracking-wider text-slate-500">Структура расходов</h3>

      <div className="space-y-2">
        {categoryStats.map((stat) => {
          const cat = expenseCategories.find((c) => c.id === stat.categoryId);
          const percent =
            currentMonthStats.expenseTotal > 0
              ? Math.round((stat.amount / currentMonthStats.expenseTotal) * 100)
              : 0;
          const barWidth = percent < 5 ? 5 : percent;
          const styles = getColorStyles(cat?.color || 'slate');

          return (
            <div
              key={stat.categoryId}
              onClick={() => setSelectedCategory(stat.categoryId)}
              className="group flex cursor-pointer items-center gap-4 rounded-[20px] border border-white/5 bg-[#1c1c1e] px-4 py-4 shadow-sm transition-colors hover:bg-[#2c2c2e]"
            >
              <div className={`h-12 w-12 flex-shrink-0 rounded-2xl ${styles.soft} flex items-center justify-center text-2xl`}>
                {cat?.emoji || '⚠️'}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="truncate text-[15px] font-bold text-white">{cat?.name || 'Архив'}</span>
                  <span className="whitespace-nowrap text-[15px] font-bold tracking-wide text-white">
                    ₽ {stat.amount.toLocaleString('ru-RU')}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#2c2c2e]">
                    <div
                      className={`h-full rounded-full ${styles.bar} transition-all duration-1000 ease-out`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span className="min-w-[28px] text-right text-[11px] font-bold text-slate-500">{percent}%</span>
                </div>
              </div>
            </div>
          );
        })}

        {categoryStats.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-[24px] border border-dashed border-white/5 py-10 text-center text-slate-500">
            <PieChart size={24} className="opacity-20" />
            <p className="text-xs font-medium">Нет расходов в этом периоде</p>
          </div>
        )}
      </div>
    </div>
  </>
);

const ReportsView = ({
  transactions,
  expenseCategories,
  incomeCategories,
  setSelectedCategory,
  onDeleteTx,
  onEditTx
}) => {
  const [period, setPeriod] = useState('month');
  const [viewTab, setViewTab] = useState('chart');

  const { totalSpent, categoryStats, groupedTransactions } = useMemo(() => {
    const now = new Date();
    let start;
    let end;

    if (period === 'week') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    }

    const validTx = transactions.filter((tx) => tx.date >= start && tx.date <= end);
    const expenseTx = validTx.filter((tx) => tx.type === 'expense');

    let total = 0;
    const categoryMap = {};

    expenseTx.forEach((tx) => {
      total += tx.amount;
      if (!categoryMap[tx.categoryId]) {
        categoryMap[tx.categoryId] = { categoryId: tx.categoryId, amount: 0 };
      }
      categoryMap[tx.categoryId].amount += tx.amount;
    });

    const catStatsArray = Object.values(categoryMap).sort((a, b) => b.amount - a.amount);

    const groups = {};

    [...validTx]
      .sort((a, b) => b.date - a.date)
      .forEach((tx) => {
        const dayKey = tx.date
          .toLocaleDateString('ru-RU', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })
          .toUpperCase();

        if (!groups[dayKey]) {
          groups[dayKey] = { dateStr: dayKey, items: [], totalExpense: 0 };
        }

        groups[dayKey].items.push(tx);
        if (tx.type === 'expense') groups[dayKey].totalExpense += tx.amount;
      });

    return {
      totalSpent: total,
      categoryStats: catStatsArray,
      groupedTransactions: Object.values(groups)
    };
  }, [transactions, period]);

  return (
    <div className="flex h-full flex-col">
      <div className="z-10 bg-[#09090b] px-4 pb-4 pt-[max(3rem,env(safe-area-inset-top))]">
        <h2 className="mb-6 text-2xl font-bold text-white">Отчеты</h2>

        <div className="mb-4 flex w-full rounded-2xl border border-white/5 bg-[#1c1c1e] p-1 shadow-sm">
          <button
            onClick={() => setViewTab('chart')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-bold transition-all ${viewTab === 'chart' ? 'bg-[#2c2c2e] text-white shadow' : 'text-slate-400'}`}
          >
            <BarChart3 size={16} /> Графики
          </button>
          <button
            onClick={() => setViewTab('history')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-bold transition-all ${viewTab === 'history' ? 'bg-[#2c2c2e] text-white shadow' : 'text-slate-400'}`}
          >
            <ListOrdered size={16} /> История
          </button>
        </div>

        <div className="flex w-full gap-2">
          <button
            onClick={() => setPeriod('week')}
            className={`flex-1 rounded-xl border py-2 text-[13px] font-bold transition-all ${period === 'week' ? 'border-[#5856D6]/30 bg-[#5856D6]/20 text-[#5856D6]' : 'border-white/5 bg-transparent text-slate-500 hover:bg-white/5'}`}
          >
            Неделя
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`flex-1 rounded-xl border py-2 text-[13px] font-bold transition-all ${period === 'month' ? 'border-[#5856D6]/30 bg-[#5856D6]/20 text-[#5856D6]' : 'border-white/5 bg-transparent text-slate-500 hover:bg-white/5'}`}
          >
            Месяц
          </button>
          <button
            onClick={() => setPeriod('year')}
            className={`flex-1 rounded-xl border py-2 text-[13px] font-bold transition-all ${period === 'year' ? 'border-[#5856D6]/30 bg-[#5856D6]/20 text-[#5856D6]' : 'border-white/5 bg-transparent text-slate-500 hover:bg-white/5'}`}
          >
            Год
          </button>
        </div>
      </div>

      <div className="scrollbar-hide flex-1 overflow-y-auto px-4 pb-32">
        {viewTab === 'chart' && (
          <div>
            <div className="mb-8 rounded-[24px] border border-white/5 bg-[#1c1c1e] p-6 shadow-lg">
              <div className="mb-2 text-center">
                <span className="block text-[13px] font-medium text-slate-500">Расходы за выбранный период</span>
              </div>

              {totalSpent > 0 ? (
                <div className="mb-2 mt-6 flex justify-center">
                  <DonutChart data={categoryStats} total={totalSpent} categories={expenseCategories} />
                </div>
              ) : (
                <div className="mb-2 mt-4 text-center">
                  <span className="text-3xl font-bold tracking-tight text-white">₽ 0</span>
                </div>
              )}
            </div>

            <h3 className="mb-4 pl-1 text-sm font-bold uppercase tracking-wider text-slate-500">Структура расходов</h3>
            <div className="space-y-2">
              {categoryStats.map((stat) => {
                const cat = expenseCategories.find((c) => c.id === stat.categoryId);
                const percent = totalSpent > 0 ? Math.round((stat.amount / totalSpent) * 100) : 0;
                const barWidth = percent < 5 ? 5 : percent;
                const styles = getColorStyles(cat?.color || 'slate');

                return (
                  <div
                    key={stat.categoryId}
                    onClick={() => setSelectedCategory(stat.categoryId)}
                    className="group flex cursor-pointer items-center gap-4 rounded-[20px] border border-white/5 bg-[#1c1c1e] px-4 py-4 shadow-sm transition-colors hover:bg-[#2c2c2e]"
                  >
                    <div className={`h-12 w-12 flex-shrink-0 rounded-2xl ${styles.soft} flex items-center justify-center text-2xl`}>
                      {cat?.emoji || '⚠️'}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-[15px] font-bold text-white">{cat?.name || 'Архив'}</span>
                        <span className="whitespace-nowrap text-[15px] font-bold tracking-wide text-white">
                          ₽ {stat.amount.toLocaleString('ru-RU')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#2c2c2e]">
                          <div
                            className={`h-full rounded-full ${styles.bar} transition-all duration-1000 ease-out`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="min-w-[28px] text-right text-[11px] font-bold text-slate-500">
                          {percent}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {categoryStats.length === 0 && (
                <div className="flex flex-col items-center gap-3 rounded-[24px] border-2 border-dashed border-white/5 py-16 text-center text-slate-500">
                  <PieChart size={32} className="opacity-20" />
                  <p className="text-[15px] font-medium">Нет расходов в этом периоде</p>
                </div>
              )}
            </div>
          </div>
        )}

        {viewTab === 'history' && (
          <div>
            {groupedTransactions.map((group, index) => (
              <div key={index} className="mb-6">
                <h3 className="mb-2 pl-1 text-xs font-bold uppercase tracking-widest text-slate-500">{group.dateStr}</h3>
                <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#1c1c1e] divide-y divide-white/5">
                  {group.items.map((tx) => {
                    const isIncome = tx.type === 'income';
                    const cat = isIncome
                      ? incomeCategories.find((c) => c.id === tx.categoryId)
                      : expenseCategories.find((c) => c.id === tx.categoryId);

                    return (
                      <div
                        key={tx.id}
                        onClick={() => onEditTx(tx)}
                        className="group/item flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-[#2c2c2e]/50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2c2c2e] text-xl">
                              {cat ? cat.emoji : '⚠️'}
                            </div>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[15px] font-semibold text-white">
                              {cat ? cat.name : tx.comment || 'Без категории'}
                            </span>
                            <span className="flex items-center gap-1 text-[12px] text-slate-500">{tx.comment}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-[15px] font-bold ${isIncome ? 'text-green-500' : 'text-white'}`}>
                            {isIncome ? '+' : ''}₽ {tx.amount.toLocaleString('ru-RU')}
                          </span>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onDeleteTx(tx);
                            }}
                            className="text-slate-600 opacity-0 hover:text-red-500 group-hover/item:opacity-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {group.totalExpense > 0 && (
                  <div className="mt-2 flex justify-end px-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                      Расход: <span className="ml-1 text-slate-300">₽ {group.totalExpense.toLocaleString('ru-RU')}</span>
                    </span>
                  </div>
                )}
              </div>
            ))}

            {groupedTransactions.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-20 text-slate-500 opacity-50">
                <AlertCircle size={40} />
                <p className="text-[15px]">Нет операций за период</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const BottomNav = ({ activeTab, setActiveTab, onAdd }) => (
  <div className="absolute bottom-0 left-0 right-0 z-30 flex items-end justify-between border-t border-white/5 bg-[#09090b]/95 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
    <button
      onClick={() => setActiveTab('home')}
      className={`group flex w-[33%] flex-col items-center gap-1 ${activeTab === 'home' ? 'text-white' : 'text-slate-500'}`}
    >
      <LayoutGrid
        size={24}
        strokeWidth={activeTab === 'home' ? 2.5 : 2}
        className="transition-transform group-active:scale-90"
      />
      <span className="text-[10px] font-bold">Главная</span>
    </button>

    <div className="flex w-[33%] justify-center">
      <button onClick={onAdd} className="group relative z-10 -mt-8 flex flex-col items-center">
        <div className="flex h-[56px] w-[56px] items-center justify-center rounded-full border-[6px] border-[#09090b] bg-[#5856D6] text-white shadow-[0_0_20px_rgba(88,86,214,0.4)] transition-transform group-active:scale-95">
          <Plus size={24} strokeWidth={3} />
        </div>
        <span className="mt-1 text-[10px] font-bold text-slate-400 group-hover:text-white">Добавить</span>
      </button>
    </div>

    <button
      onClick={() => setActiveTab('reports')}
      className={`group flex w-[33%] flex-col items-center gap-1 ${activeTab === 'reports' ? 'text-white' : 'text-slate-500'}`}
    >
      <PieChart
        size={24}
        strokeWidth={activeTab === 'reports' ? 2.5 : 2}
        className="transition-transform group-active:scale-90"
      />
      <span className="text-[10px] font-bold">Аналитика</span>
    </button>
  </div>
);

const DonutChart = ({ data, total, categories }) => {
  const size = 160;
  const strokeWidth = 24;
  const center = size / 2;
  const radius = center - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  return (
    <div className="relative flex items-center justify-center drop-shadow-xl" style={{ width: size, height: size }}>
      <svg className="h-full w-full -rotate-90 transform">
        <circle cx={center} cy={center} r={radius} stroke="#2c2c2e" strokeWidth={strokeWidth} fill="none" />
        {data.map((item) => {
          if (item.amount === 0) return null;
          const percent = item.amount / total;
          const strokeLength = percent * circumference;
          const offset = currentOffset;
          currentOffset += strokeLength;
          const cat = categories.find((c) => c.id === item.categoryId);
          const hexColor = getHexColor(cat?.color);

          return (
            <circle
              key={item.categoryId}
              cx={center}
              cy={center}
              r={radius}
              stroke={hexColor}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${strokeLength} ${circumference}`}
              strokeDashoffset={-offset}
              className="transition-all duration-1000 ease-out"
            />
          );
        })}
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Всего</span>
        <span className="text-lg font-bold leading-none text-white">
          ₽ {total >= 100000 ? `${(total / 1000).toFixed(0)}k` : total.toLocaleString('ru-RU')}
        </span>
      </div>
    </div>
  );
};

const CircleProgress = ({ percentage, color, size = 40, strokeWidth = 4 }) => {
  const safePercent = Math.min(100, Math.max(0, percentage || 0));
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safePercent / 100) * circumference;

  const stroke = color?.startsWith('#') ? color : getHexColor(color || 'purple');

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={center}
        cy={center}
        r={radius}
        stroke="rgba(255,255,255,0.14)"
        strokeWidth={strokeWidth}
        fill="none"
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
};

const EditBalanceSheet = ({ currentBalance, onClose, onSave }) => {
  const [val, setVal] = useState(currentBalance.toString());

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-[32px] border border-white/10 bg-[#1c1c1e] p-6 shadow-2xl">
        <h3 className="mb-6 text-center text-xl font-bold text-white">Изменить капитал</h3>
        <p className="mb-6 text-center text-xs text-slate-500">
          Введите общую сумму денег, которая у вас сейчас есть
        </p>
        <div className="relative mb-8">
          <input
            type="number"
            inputMode="decimal"
            value={val}
            onChange={(event) => setVal(event.target.value)}
            autoFocus
            className="w-full border-b border-white/10 bg-transparent py-4 text-center text-4xl font-bold focus:border-[#5856D6] focus:outline-none"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-2xl bg-[#2c2c2e] py-4 text-[16px] font-bold text-white">
            Отмена
          </button>
          <button
            onClick={() => onSave(val)}
            className="flex-1 rounded-2xl bg-[#5856D6] py-4 text-[16px] font-bold text-white shadow-lg shadow-[#5856D6]/30"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};

const CategoryDetailView = ({ categoryId, category, transactions, onBack, onDeleteTx, onEditTx }) => {
  const categoryTransactions = [...transactions]
    .filter((tx) => tx.categoryId === categoryId)
    .sort((a, b) => b.date - a.date);

  return (
    <div className="animate-in flex h-full flex-col slide-in-from-right duration-300">
      <div className="z-10 flex items-center gap-3 border-b border-white/5 bg-[#09090b] px-4 pb-4 pt-[max(3rem,env(safe-area-inset-top))]">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1c1c1e] text-white transition-transform active:scale-95"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className="flex items-center gap-2 text-xl font-bold text-white">
            {category?.emoji || '⚠️'} {category?.name || 'Архив'}
          </h2>
        </div>
      </div>

      <div className="scrollbar-hide flex-1 overflow-y-auto px-4 pb-32 pt-4">
        {categoryTransactions.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-slate-500">
            <p className="text-[15px]">Нет операций в этой категории</p>
          </div>
        ) : (
          <div className="space-y-3">
            {categoryTransactions.map((tx) => (
              <div
                key={tx.id}
                onClick={() => onEditTx(tx)}
                className="group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/5 bg-[#1c1c1e] p-4 shadow-sm transition-colors hover:bg-[#2c2c2e]/50"
              >
                <div className="flex flex-1 flex-col gap-1">
                  <span className="text-[15px] font-medium text-white">{tx.comment}</span>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {tx.date.toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[15px] font-bold text-white">₽ {tx.amount.toLocaleString('ru-RU')}</span>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteTx(tx);
                    }}
                    className="text-slate-600 opacity-0 transition-colors hover:text-red-500 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const AddTransactionSheet = ({ expenseCategories, incomeCategories, initialData, onClose, onSave }) => {
  const [type, setType] = useState(initialData?.type || 'expense');
  const [amount, setAmount] = useState(initialData?.amount?.toString() || '');
  const [selectedCat, setSelectedCat] = useState(
    initialData?.type === 'expense' ? initialData.categoryId : expenseCategories[0]?.id
  );
  const [selectedIncomeCat, setSelectedIncomeCat] = useState(
    initialData?.type === 'income' ? initialData.categoryId : incomeCategories[0]?.id
  );
  const [comment, setComment] = useState(initialData?.comment || '');

  const categories = type === 'expense' ? expenseCategories : incomeCategories;
  const currentSelected = type === 'expense' ? selectedCat : selectedIncomeCat;
  const setCategory = type === 'expense' ? setSelectedCat : setSelectedIncomeCat;

  useEffect(() => {
    const isSelectedAvailable = categories.some((category) => category.id === currentSelected);
    if (!isSelectedAvailable && categories.length > 0) {
      setCategory(categories[0].id);
    }
  }, [categories, currentSelected, setCategory]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!amount) return;

    const category = type === 'expense' ? selectedCat : selectedIncomeCat;
    const defaultComment = type === 'expense' ? 'Расход' : 'Доход';

    onSave({
      amount: parseFloat(amount),
      type,
      categoryId: category,
      comment: comment || defaultComment
    });
  };

  return (
    <div className="absolute inset-0 z-40 flex items-end">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px] transition-opacity" onClick={onClose} />
      <div className="relative flex h-[85dvh] w-full flex-col rounded-t-[32px] border-t border-white/10 bg-[#1c1c1e] p-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-zinc-600 opacity-40" />
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full bg-[#2c2c2e] p-2 text-slate-400 hover:text-white"
        >
          <X size={20} />
        </button>

        <div className="mb-6 flex flex-shrink-0 rounded-2xl bg-[#2c2c2e] p-1">
          <button
            onClick={() => setType('expense')}
            className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all ${type === 'expense' ? 'bg-[#1c1c1e] text-white shadow' : 'text-slate-400'}`}
          >
            Расход
          </button>
          <button
            onClick={() => setType('income')}
            className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all ${type === 'income' ? 'bg-[#1c1c1e] text-green-500 shadow' : 'text-slate-400'}`}
          >
            Доход
          </button>
        </div>

        <form onSubmit={handleSubmit} className="scrollbar-hide flex flex-1 flex-col overflow-y-auto">
          <div className="mb-6 text-center">
            <div className="inline-flex items-baseline justify-center gap-1 border-b border-zinc-700 px-4 pb-2 text-white">
              <span className="mr-1 text-2xl font-bold text-zinc-500">₽</span>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0"
                autoFocus
                className="w-48 bg-transparent text-center text-5xl font-bold caret-[#5856D6] placeholder:text-zinc-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="animate-in fade-in">
              <label className="mb-2 block px-1 text-xs font-bold uppercase tracking-wider text-zinc-500">Категория</label>
              <div className="grid grid-cols-4 gap-2">
                {categories.map((cat) => {
                  const styles = getColorStyles(cat.color);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`aspect-square flex flex-col items-center justify-center rounded-xl border p-2 transition-all ${currentSelected === cat.id ? `${styles.soft} ${styles.border} ${styles.text}` : 'border-transparent bg-[#2c2c2e] text-slate-400 hover:bg-[#2c2c2e]/70'}`}
                    >
                      <span className="mb-1 text-2xl">{cat.emoji}</span>
                      <span className="w-full truncate text-center text-[10px] font-bold">{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <input
              type="text"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Комментарий"
              className="w-full rounded-xl bg-[#2c2c2e] px-4 py-4 text-[16px] font-medium text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#5856D6]"
            />

            <button
              type="submit"
              disabled={!amount}
              className="mt-auto w-full rounded-2xl bg-white py-4 text-[16px] font-bold text-black transition-colors hover:bg-zinc-200 disabled:opacity-50"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const SettingsSheet = ({ onClose, onExport, onImport, onManageCategories, cloudStatus }) => (
  <div className="absolute inset-0 z-50 flex items-end justify-center">
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
    <div className="relative z-10 w-full rounded-t-[32px] border-t border-white/10 bg-[#1c1c1e] p-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-white">
      <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-zinc-600 opacity-40" />
      <h3 className="mb-6 text-center text-xl font-bold text-white">Настройки</h3>

      <div className="mb-4 rounded-2xl border border-white/5 bg-[#2c2c2e] p-4 text-sm">
        <div className="mb-1 flex items-center justify-between">
          <span className="flex items-center gap-2 text-slate-400">
            {cloudStatus === 'synced' ? <Cloud size={16} className="text-[#5856D6]" /> : <CloudOff size={16} />}
            Облачное сохранение
          </span>
          <span
            className={`font-bold ${cloudStatus === 'synced' ? 'text-green-500' : cloudStatus === 'local' ? 'text-yellow-500' : cloudStatus === 'error' ? 'text-red-500' : 'text-slate-500'}`}
          >
            {cloudStatus === 'synced'
              ? 'Включено'
              : cloudStatus === 'local'
                ? 'Только на устройстве'
                : cloudStatus === 'error'
                  ? 'Ошибка'
                  : 'Загрузка...'}
          </span>
        </div>
        {cloudStatus === 'local' && (
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Добавьте JSON-конфиг Firebase в переменную окружения VITE_FIREBASE_CONFIG.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <button
          onClick={onManageCategories}
          className="group flex w-full items-center justify-between rounded-2xl bg-[#2c2c2e] p-4 transition-colors hover:bg-[#3a3a3c]"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-500/20 p-2 text-blue-500">
              <ListIcon size={20} />
            </div>
            <div className="text-left">
              <p className="text-[15px] font-bold text-white">Управление категориями</p>
              <p className="text-xs text-slate-500">Добавить или удалить</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-slate-600" />
        </button>

        <button
          onClick={onExport}
          className="group flex w-full items-center justify-between rounded-2xl bg-[#2c2c2e] p-4 transition-colors hover:bg-[#3a3a3c]"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#5856D6]/20 p-2 text-[#5856D6]">
              <Download size={20} />
            </div>
            <div className="text-left">
              <p className="text-[15px] font-bold text-white">Скачать резервную копию</p>
              <p className="text-xs text-slate-500">Сохранить .json файл</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-slate-600" />
        </button>

        <label className="group flex w-full cursor-pointer items-center justify-between rounded-2xl bg-[#2c2c2e] p-4 transition-colors hover:bg-[#3a3a3c]">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-green-500/20 p-2 text-green-500">
              <Upload size={20} />
            </div>
            <div className="text-left">
              <p className="text-[15px] font-bold text-white">Восстановить данные</p>
              <p className="text-xs text-slate-500">Загрузить файл backup.json</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-slate-600" />
          <input type="file" accept=".json" onChange={onImport} className="hidden" />
        </label>
      </div>
    </div>
  </div>
);

const ManageCategoriesSheet = ({ expenseCategories, incomeCategories, onClose, onDelete, onAdd }) => {
  const [tab, setTab] = useState('expense');
  const categories = tab === 'expense' ? expenseCategories : incomeCategories;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[80dvh] w-full max-w-sm flex-col rounded-[32px] border border-white/10 bg-[#1c1c1e] p-6 text-white">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Категории</h3>
          <button onClick={onClose} className="rounded-full bg-[#2c2c2e] p-2 text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="mb-4 flex flex-shrink-0 rounded-2xl bg-[#2c2c2e] p-1">
          <button
            onClick={() => setTab('expense')}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${tab === 'expense' ? 'bg-[#1c1c1e] text-white shadow' : 'text-slate-400'}`}
          >
            Расходы
          </button>
          <button
            onClick={() => setTab('income')}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${tab === 'income' ? 'bg-[#1c1c1e] text-green-500 shadow' : 'text-slate-400'}`}
          >
            Доходы
          </button>
        </div>

        <div className="scrollbar-hide flex-1 space-y-2 overflow-y-auto pr-1 text-white">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-[#2c2c2e]/50 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2c2c2e] text-xl">
                  {cat.emoji}
                </div>
                <span className="text-[15px] font-medium text-white">{cat.name}</span>
              </div>
              <button
                onClick={() => onDelete(cat.id, tab)}
                className="p-2 text-slate-500 transition-colors hover:text-red-500"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => onAdd(tab)}
          className="mt-4 flex w-full flex-shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#5856D6] py-3.5 text-[16px] font-bold text-white transition-colors hover:bg-[#4745ba]"
        >
          <Plus size={20} /> Создать категорию
        </button>
      </div>
    </div>
  );
};

const CategoryFormSheet = ({ type, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🛒');
  const [color, setColor] = useState('purple');

  const emojis =
    type === 'expense'
      ? ['🛒', '🚕', '🛍️', '🏠', '❤️', '🚴', '☕', '🎳', '🎮', '📱', '📚', '💅']
      : ['💰', '👨‍💻', '🎁', '📈', '💵', '💎', '🏠', '🤝'];

  const colors = ['purple', 'blue', 'pink', 'yellow', 'red', 'green', 'orange', 'slate'];

  return (
    <div className="absolute inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-t-[32px] border-t border-white/10 bg-[#1c1c1e] p-6 pb-[max(2rem,env(safe-area-inset-bottom))] text-white sm:rounded-[32px] sm:pb-6">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Новая категория</h3>
          <button onClick={onClose} className="rounded-full bg-[#2c2c2e] p-2 text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500">Название</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например, Подписки"
              className="w-full rounded-xl bg-[#2c2c2e] px-4 py-3 text-[16px] text-white focus:outline-none focus:ring-1 focus:ring-[#5856D6]"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500">Иконка</label>
            <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-2">
              {emojis.map((item) => (
                <button
                  key={item}
                  onClick={() => setEmoji(item)}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-all ${emoji === item ? 'bg-[#5856D6] text-white shadow-lg' : 'bg-[#2c2c2e] text-white/50 hover:bg-[#3a3a3c]'}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500">Цвет</label>
            <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-2">
              {colors.map((item) => {
                const styles = getColorStyles(item);
                return (
                  <button
                    key={item}
                    onClick={() => setColor(item)}
                    className={`h-8 w-8 rounded-full transition-transform ${color === item ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#1c1c1e]' : ''} ${styles.bar}`}
                  />
                );
              })}
            </div>
          </div>

          <button
            onClick={() => onSave({ name, emoji, color })}
            disabled={!name}
            className="mt-4 w-full rounded-2xl bg-[#5856D6] py-4 text-[16px] font-bold text-white disabled:opacity-50"
          >
            Создать
          </button>
        </div>
      </div>
    </div>
  );
};

const GoalDetailSheet = ({ goal, onClose, onTopUp, onEdit, onDelete }) => {
  const [amount, setAmount] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-[32px] border border-white/10 bg-[#1c1c1e] p-6 text-white">
        <div className="mb-6 flex items-center justify-between">
          <button onClick={onClose} className="rounded-full bg-[#2c2c2e] p-2 text-slate-400 hover:text-white">
            <X size={20} />
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="rounded-full bg-[#2c2c2e] p-2 text-slate-400 hover:text-white">
              <Pencil size={18} />
            </button>
            <button
              onClick={() => {
                if (showDeleteConfirm) {
                  onDelete();
                } else {
                  setShowDeleteConfirm(true);
                }
              }}
              className={`flex items-center justify-center rounded-full p-2 transition-all ${showDeleteConfirm ? 'w-auto bg-red-500/20 px-3 text-red-500' : 'bg-[#2c2c2e]/50 text-red-500 hover:bg-red-500/10'}`}
            >
              {showDeleteConfirm ? <span className="mr-1 text-xs font-bold">Удалить?</span> : <Trash2 size={18} />}
              {showDeleteConfirm && <Trash2 size={14} />}
            </button>
          </div>
        </div>

        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#2c2c2e] text-5xl">
            {goal.emoji}
          </div>
          <h3 className="text-2xl font-bold text-white">{goal.name}</h3>
          <p className="mt-1 text-sm text-slate-500">
            Накоплено: <span className="font-medium text-white">₽ {goal.current.toLocaleString('ru-RU')}</span> из ₽{' '}
            {goal.target.toLocaleString('ru-RU')}
          </p>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-center text-xs font-bold uppercase tracking-wider text-zinc-500">
            Сумма пополнения
          </label>
          <div className="inline-flex w-full items-baseline justify-center gap-1 border-b border-zinc-700 pb-2 text-white">
            <span className="mr-1 text-xl font-bold text-zinc-500">₽</span>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0"
              autoFocus
              className="w-32 bg-transparent text-center text-4xl font-bold caret-[#5856D6] placeholder:text-zinc-600 focus:outline-none"
            />
          </div>
        </div>

        <button
          onClick={() => onTopUp(amount)}
          disabled={!amount}
          className="w-full rounded-2xl bg-[#5856D6] py-3.5 text-[16px] font-bold text-white transition-colors hover:bg-[#4745ba] disabled:opacity-50"
        >
          Пополнить копилку
        </button>
      </div>
    </div>
  );
};

const GoalFormSheet = ({ initialData, onClose, onSave }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [target, setTarget] = useState(initialData?.target || '');
  const [emoji, setEmoji] = useState(initialData?.emoji || '🎯');
  const [color, setColor] = useState(initialData?.color || '#5856D6');

  const colors = ['#5856D6', '#34C759', '#FF9500', '#FF2D55', '#AF52DE', '#007AFF'];
  const emojis = ['🎯', '💻', '🚗', '🏠', '✈️', '🏝️', '💍', '🎁', '🔧'];

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!name || !target) return;
    onSave({ name, target: parseFloat(target), emoji, color });
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center p-0 text-white sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-t-[32px] border-t border-white/10 bg-[#1c1c1e] p-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:rounded-[32px] sm:pb-6">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">{initialData ? 'Редактировать' : 'Новая цель'}</h3>
          <button onClick={onClose} className="rounded-full bg-[#2c2c2e] p-2 text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500">Название</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например, MacBook"
              className="w-full rounded-xl bg-[#2c2c2e] px-4 py-3 text-[16px] text-white focus:outline-none focus:ring-1 focus:ring-[#5856D6]"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500">Сумма цели</label>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder="0"
                className="w-full rounded-xl bg-[#2c2c2e] px-4 py-3 pl-8 text-[16px] text-white focus:outline-none focus:ring-1 focus:ring-[#5856D6]"
              />
              <span className="absolute left-4 top-3 text-zinc-500">₽</span>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500">Иконка</label>
            <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-2">
              {emojis.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setEmoji(item)}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-all ${emoji === item ? 'bg-[#5856D6] text-white shadow-lg' : 'bg-[#2c2c2e] text-white/50 hover:bg-[#3a3a3c]'}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500">Цвет</label>
            <div className="scrollbar-hide flex gap-3">
              {colors.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setColor(item)}
                  className={`h-8 w-8 flex-shrink-0 rounded-full transition-transform ${color === item ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#1c1c1e]' : ''}`}
                  style={{ backgroundColor: item }}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!name || !target}
            className="mt-4 w-full rounded-2xl bg-[#5856D6] py-4 text-[16px] font-bold text-white disabled:opacity-50"
          >
            Сохранить
          </button>
        </form>
      </div>
    </div>
  );
};

export default App;
