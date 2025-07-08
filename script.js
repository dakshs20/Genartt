// This console log will appear if the script file is even loaded and parsed.
console.log(Date.now(), "script.js: File started parsing.");

// Import Firebase functions directly as a module
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, orderBy, limit, addDoc, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// NEW: Import Firebase Functions SDK for Razorpay
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

// GSAP is loaded via CDN, so it's globally available as `gsap`

console.log(Date.now(), "script.js: Firebase imports attempted.");

// --- Firebase Configuration (Declared at top level) ---
const firebaseConfig = {
    apiKey: "AIzaSyCcSkzSdz_GtjYQBV5sTUuPxu1BwTZAq7Y", // REPLACE WITH YOUR ACTUAL API KEY
    authDomain: "genart-a693a.firebaseapp.com",
    projectId: "genart-a693a",
    storageBucket: "genart-a693a.firebasestorage.app",
    messagingSenderId: "96958671615",
    appId: "1:96958671615:web:6a0d3aa6bf42c6bda17aca",
    measurementId: "G-EDCW8VYXY6"
};
console.log(Date.now(), "script.js: Firebase config defined at top level.");

// --- Firebase App and Service Variables (Declared at top level, initialized later) ---
let firebaseApp;
let auth;
let db;
let googleProvider;
let functions; // For Firebase Functions

// --- State variables (Declared at top level and initialized) ---
let currentUser = null; // Stores Firebase User object
// For unauthenticated users, credits are stored in localStorage
// For authenticated users, credits are fetched from Firestore.
let currentCredits = localStorage.getItem('unauthenticatedCredits') !== null && !isNaN(parseInt(localStorage.getItem('unauthenticatedCredits')))
    ? parseInt(localStorage.getItem('unauthenticatedCredits'))
    : 5; // Default to 5 credits for unauthenticated users
console.log(Date.now(), `script.js: Initial currentCredits set to: ${currentCredits} (from localStorage or default).`);

let prompt = ''; // For image generator
let imageUrl = ''; // For generated image
let loading = false; // For image generation
let currentError = ''; // Error message for display
let currentPage = 'home'; // 'home', 'generator', 'pricing'
let isSigningIn = false; // New state for sign-in loading
let isAuthReady = false; // Flag to indicate if Firebase Auth state has been checked and services initialized

let aspectRatio = '1:1'; // Default aspect ratio

let enhancedPrompt = '';
let loadingEnhancePrompt = false;
let variationIdeas = [];
let loadingVariationIdeas = false;

// IMPORTANT: Your Google Cloud API Key for Imagen/Gemini (Declared at top level)
const IMAGEN_GEMINI_API_KEY = "AIzaSyBZxXWl9s2AeSCzMrfoEfnYWpGyfvP7jqs"; // <--- YOUR GEMINI API KEY
console.log(Date.now(), "script.js: IMAGEN_GEMINI_API_KEY value set at top level.");

// Razorpay Key ID (REPLACE WITH YOUR ACTUAL RAZORPAY LIVE KEY ID)
const RAZORPAY_KEY_ID = "rzp_live_Sfj1AqiaMdhJLD"; // <--- THIS IS THE LINE FOR YOUR PUBLIC KEY ID - ENSURE THIS IS YOUR LIVE KEY ID
console.log(Date.now(), "script.js: RAZORPAY_KEY_ID set at top level.");


// --- UI Element References (Will be populated in initApp) ---
let homePageElement;
let generatorPageElement;
let pricingPageElement; // NEW: Reference for pricing page
let allPageElements = [];

let persistentDebugMessage;
let closeDebugMessageBtn;

let promptInput;
let copyPromptBtn;
let clearPromptBtn;
let aspectRatioSelectionDiv;
let generateBtn;
let enhanceBtn;
let variationBtn;
let useEnhancedPromptBtn;
let downloadBtn;
let errorDisplay;
let imageDisplayContainer;
let generatedImageElement;
let enhancedPromptDisplay;
let enhancedPromptText;
let variationIdeasDisplay;
let variationIdeasList;

let userDisplayDesktop;
let signInBtnDesktop;
let signOutBtnDesktop;
let userDisplayMobile;
let signInBtnMobile;
let signOutBtnMobile;
let creditsDisplay; // For desktop header
let creditsDisplayMobile; // For mobile header
let creditsDisplayGenerator; // For generator page
let signinRequiredModal;
let modalSignInBtn;
let closeSigninModalBtn;
let startCreatingBtn;
let logoBtn;

let hamburgerBtn;
let hamburgerIcon;
let mobileMenu;
let mobileMenuOverlay;
let closeMobileMenuBtn;
let mobileNavLinks;

let homeBtnDesktop;
let generatorBtnDesktop;
let pricingBtnDesktop; // NEW: Reference for desktop pricing button

let mobileHomeBtn;
let mobileGeneratorBtn;
let mobilePricingBtn; // NEW: Reference for mobile pricing button

let toastContainer;

let buyMoreCreditsModal; // NEW: Reference for buy more credits modal
let goToPricingBtn; // NEW: Reference for button in buy more credits modal
let closeBuyCreditsModalBtn; // NEW: Reference for close button in buy more credits modal

// Plan definitions for Razorpay
const plans = {
    'pixel-pulse': { name: 'Pixel Pulse', price: 5, credits: 210, theme: 'purple' },
    'vision-crafter': { name: 'VisionCrafter', price: 9, credits: 440, theme: 'blue' },
    'dream-forge': { name: 'DreamForge', price: 13.99, credits: 850, theme: 'green' }
};


// --- Helper function to get elements and log if not found ---
const getElement = (id) => {
    const element = document.getElementById(id);
    if (!element) {
        console.error(Date.now(), `getElement: Element with ID '${id}' NOT FOUND in the DOM.`);
    } else {
        console.log(Date.now(), `getElement: Element with ID '${id}' FOUND.`);
    }
    return element;
};

// --- Firebase Initialization Function ---
function initFirebase() {
    console.log(Date.now(), "initFirebase: Initializing Firebase services...");
    try {
        firebaseApp = initializeApp(firebaseConfig);
        auth = getAuth(firebaseApp);
        db = getFirestore(firebaseApp);
        functions = getFunctions(firebaseApp); // Initialize Firebase Functions
        googleProvider = new GoogleAuthProvider();
        console.log(Date.now(), "initFirebase: Firebase services initialized successfully.");

        onAuthStateChanged(auth, async (user) => {
            console.log(Date.now(), "onAuthStateChanged: Auth state change detected. User:", user ? user.uid : "null");
            currentUser = user;
            if (user) {
                console.log(Date.now(), "onAuthStateChanged: User logged in. Attempting to fetch user data from Firestore.");
                try {
                    await fetchUserData(user.uid);
                    console.log(Date.now(), "onAuthStateChanged: User data fetch completed successfully.");
                } catch (dataFetchError) {
                    console.error(Date.now(), "onAuthStateChanged: Error fetching user data:", dataFetchError);
                    setError(`Failed to load user data: ${dataFetchError.message}. Some features may be limited.`);
                    showToast(`Failed to load user data: ${dataFetchError.message}`, "error", 5000);
                }
            } else {
                console.log(Date.now(), "onAuthStateChanged: User logged out or no user detected. Using local storage for credits.");
                currentUser = null;
                if (localStorage.getItem('unauthenticatedCredits') === null || isNaN(parseInt(localStorage.getItem('unauthenticatedCredits')))) {
                    currentCredits = 5; // Default free credits
                    localStorage.setItem('unauthenticatedCredits', currentCredits);
                    console.log(Date.now(), "onAuthStateChanged: Reset unauthenticatedCredits to 5 (local storage).");
                } else {
                    currentCredits = parseInt(localStorage.getItem('unauthenticatedCredits'));
                    console.log(Date.now(), "onAuthStateChanged: Loaded unauthenticatedCredits from local storage:", currentCredits);
                }
            }
            isAuthReady = true; // Auth state is now fully processed
            console.log(Date.now(), "onAuthStateChanged: isAuthReady confirmed true. Updating UI.");
            updateUI(); // Update UI immediately after auth state is determined
            console.log(Date.now(), "onAuthStateChanged: Auth state processing complete.");
        });

    } catch (e) {
        console.error(Date.now(), "initFirebase: CRITICAL ERROR: Error initializing Firebase:", e);
        currentError = `Firebase initialization failed: ${e.message}. App may not function correctly.`;
        if (persistentDebugMessage) {
            persistentDebugMessage.classList.remove('hidden');
            const msgP = persistentDebugMessage.querySelector('p');
            if (msgP) msgP.textContent = currentError + " Please check console (F12) for details.";
        }
        throw e;
    }
}

// --- Toast Notification System ---
function showToast(message, type = 'info', duration = 3000) {
    if (!toastContainer) {
        console.warn(Date.now(), "showToast: Toast container not found. Cannot display toast.");
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    let iconClass = '';
    if (type === 'success') iconClass = 'fas fa-check-circle text-green-400';
    else if (type === 'error') iconClass = 'fas fa-times-circle text-red-500';
    else if (type === 'info') iconClass = 'fas fa-info-circle text-blue-400';
    else iconClass = 'fas fa-exclamation-triangle text-yellow-400';

    const icon = document.createElement('i');
    icon.className = iconClass + ' mr-2';
    toast.prepend(icon);

    toastContainer.appendChild(toast);
    console.log(Date.now(), `showToast: Displaying ${type} toast: "${message}"`);

    // Using GSAP for toast animation
    gsap.fromTo(toast, { opacity: 0, y: 20, scale: 0.8 }, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "back.out(1.7)" });

    setTimeout(() => {
        gsap.to(toast, { opacity: 0, y: 20, duration: 0.3, onComplete: () => toast.remove() });
        console.log(Date.now(), "showToast: Toast fading out.");
    }, duration);
}

// --- Mobile Menu Toggle Function ---
function toggleMobileMenu() {
    console.log(Date.now(), "toggleMobileMenu: Function called.");
    if (mobileMenu && mobileMenuOverlay && hamburgerBtn && hamburgerIcon) {
        const isMenuOpen = mobileMenu.classList.contains('translate-x-0');
        
        if (isMenuOpen) {
            gsap.to(mobileMenu, { x: '100%', duration: 0.4, ease: "power2.in" });
            gsap.to(mobileMenuOverlay, { opacity: 0, duration: 0.4, onComplete: () => mobileMenuOverlay.classList.add('hidden') });
        } else {
            mobileMenuOverlay.classList.remove('hidden');
            gsap.fromTo(mobileMenuOverlay, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out" });
            gsap.fromTo(mobileMenu, { x: '100%' }, { x: '0%', duration: 0.4, ease: "power2.out" });
        }
        
        hamburgerBtn.setAttribute('aria-expanded', !isMenuOpen);
        hamburgerIcon.classList.toggle('fa-bars', isMenuOpen);
        hamburgerIcon.classList.toggle('fa-times', !isMenuOpen);
        
        console.log(Date.now(), "toggleMobileMenu: Mobile menu toggled. Current state:", !isMenuOpen ? "OPEN" : "CLOSED");
    } else {
        console.error(Date.now(), "toggleMobileMenu: One or more mobile menu elements not found. Cannot toggle.");
    }
}

// --- Authentication Functions ---
async function signInWithGoogle() {
    console.log(Date.now(), "signInWithGoogle: Function entered.");
    clearError();

    if (isSigningIn) {
        console.log(Date.now(), "signInWithGoogle: Already signing in, ignoring multiple clicks.");
        return;
    }

    isSigningIn = true;
    updateSignInButtons(true);
    
    setTimeout(async () => {
        const testWindow = window.open('', '_blank', 'width=1,height=1,left=0,top=0');
        if (testWindow) {
            testWindow.close();
            console.log(Date.now(), "signInWithGoogle: Popup blocker check passed.");
        } else {
            console.warn(Date.now(), "signInWithGoogle: Popup blocker check failed. Popups might be blocked.");
            setError("Your browser might be blocking the sign-in popup. Please allow popups for this site and try again.");
            isSigningIn = false;
            updateSignInButtons(false);
            return;
        }

        console.time("signInWithPopup");
        try {
            if (!auth || !googleProvider) {
                console.error(Date.now(), "signInWithGoogle: Firebase Auth or Google Provider not initialized. Cannot sign in.");
                setError("Firebase services not ready. Please refresh and try again.");
                return;
            }
            console.log(Date.now(), "signInWithGoogle: Attempting signInWithPopup call...");
            const result = await signInWithPopup(auth, googleProvider);
            console.log(Date.now(), "signInWithPopup: signInWithPopup successful. User:", result.user.uid, result.user.displayName || result.user.email);
            hideModal(signinRequiredModal);
            hideModal(buyMoreCreditsModal); // Hide buy credits modal if open
        } catch (error) {
            console.error(Date.now(), "signInWithGoogle: Error during Google Sign-In:", error);
            console.error(Date.now(), "signInWithGoogle: Error code:", error.code);
            console.error(Date.now(), "signInWithGoogle: Error message:", error.message);
            if (error.code === 'auth/popup-closed-by-user') {
                setError('Sign-in popup closed. Please try again.');
            } else if (error.code === 'auth/cancelled-popup-request') {
                setError('Sign-in popup was already open or another request was pending. Please try again.');
            } else if (error.code === 'auth/network-request-failed') {
                setError('Network error during sign-in. Check your internet connection.');
            } else if (error.code === 'auth/unauthorized-domain') {
                setError('Authentication failed: Unauthorized domain. Please check Firebase Console -> Authentication -> Sign-in method -> Authorized domains and add your current domain (e.g., localhost, or your preview URL).');
            } else if (error.code === 'auth/popup-blocked') {
                setError('Sign-in popup was blocked by your browser. Please disable popup blockers for this site and try again.');
            }
            else {
                setError(`Failed to sign in: ${error.message}`);
            }
        } finally {
            console.timeEnd("signInWithPopup");
            isSigningIn = false;
            updateSignInButtons(false);
            updateUI();
        }
    }, 100);
}

function updateSignInButtons(loadingState) {
    console.log(Date.now(), "updateSignInButtons: Updating sign-in button state to loading:", loadingState);
    const signInButtons = [signInBtnDesktop, signInBtnMobile, modalSignInBtn];
    const buttonText = 'Sign In With Google';
    const loadingText = `
        <span class="flex items-center justify-center">
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Signing In...
        </span>
    `;

    signInButtons.forEach(btn => {
        if (btn) {
            btn.innerHTML = loadingState ? loadingText : buttonText;
            btn.disabled = loadingState;
            btn.classList.toggle('opacity-70', loadingState);
            btn.classList.toggle('cursor-not-allowed', loadingState);
        }
    });
}

async function signOutUser() {
    console.log(Date.now(), "signOutUser: Attempting signOutUser...");
    clearError();
    console.time("signOut");
    try {
        if (!auth) {
            console.error(Date.now(), "signOutUser: Firebase Auth not initialized. Cannot sign out.");
            setError("Firebase services not ready. Cannot sign out.");
            return;
        }
        await signOut(auth);
        console.log(Date.now(), "signOutUser: User signed out successfully.");
        currentCredits = 5; // Reset local storage credits to 5 upon sign out
        localStorage.setItem('unauthenticatedCredits', currentCredits);
        showToast("Signed out successfully! You have 5 new free generations.", "info");
    } catch (error) {
        console.error(Date.now(), "signOutUser: Error signing out:", error);
        setError(`Failed to sign out: ${error.message}`);
        showToast(`Failed to sign out: ${error.message}`, "error");
    } finally {
        console.timeEnd("signOut");
        updateUI();
    }
}

async function fetchUserData(uid) {
    console.log(Date.now(), `fetchUserData: Entering fetchUserData for UID: ${uid}`);
    clearError();
    if (!db) {
        console.error(Date.now(), "fetchUserData: Firestore DB not initialized. Cannot fetch user data.");
        setError("Database not ready. Please refresh.");
        return;
    }
    const userDocRef = doc(db, 'users', uid);
    try {
        console.log(Date.now(), `fetchUserData: Attempting to get document for UID: ${uid}`);
        const userDocSnap = await getDoc(userDocRef);
        console.log(Date.now(), `fetchUserData: Document snapshot received. Exists: ${userDocSnap.exists()}`);
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            currentCredits = userData.credits !== undefined ? userData.credits : 0; // Use 'credits' field
            console.log(Date.now(), "fetchUserData: Fetched existing user data:", userData);

            const unauthenticatedCredits = localStorage.getItem('unauthenticatedCredits') ? parseInt(localStorage.getItem('unauthenticatedCredits')) : 0;
            if (unauthenticatedCredits > 0) {
                currentCredits += unauthenticatedCredits;
                await updateDoc(userDocRef, { credits: currentCredits });
                localStorage.removeItem('unauthenticatedCredits');
                console.log(Date.now(), `fetchUserData: Migrated ${unauthenticatedCredits} unauthenticated credits. Total credits: ${currentCredits}`);
                showToast(`Welcome back, ${currentUser.displayName || currentUser.email}! Your free credits were added to your account.`, "success");
            } else {
                showToast(`Welcome back, ${currentUser.displayName || currentUser.email}!`, "success");
            }
        } else {
            console.log(Date.now(), "fetchUserData: User document does not exist for UID:", uid, ". Initializing new user data in Firestore with 5 free generations (migrated if any).");
            const initialCredits = localStorage.getItem('unauthenticatedCredits') ? parseInt(localStorage.getItem('unauthenticatedCredits')) : 5;
            await setDoc(userDocRef, {
                credits: initialCredits, // Use 'credits' field
                createdAt: serverTimestamp()
            });
            currentCredits = initialCredits;
            localStorage.removeItem('unauthenticatedCredits');
            console.log(Date.now(), "fetchUserData: New user data initialized in Firestore for UID:", uid);
            showToast(`Welcome, ${currentUser.displayName || currentUser.email}! You have ${currentCredits} credits.`, "success");
        }
    } catch (error) {
        console.error(Date.now(), "fetchUserData: Error fetching/initializing user data:", error);
        throw error;
    } finally {
        console.log(Date.now(), "fetchUserData: Exiting fetchUserData.");
    }
}

async function updateCreditsInFirestore(newCredits) {
    console.log(Date.now(), `updateCreditsInFirestore: Attempting to update credits to ${newCredits}. Current user: ${currentUser?.uid}`);
    if (!currentUser || !db) {
        console.warn(Date.now(), "updateCreditsInFirestore: Not authenticated or Firestore not ready. Cannot update credits.");
        return;
    }
    const userDocRef = doc(db, 'users', currentUser.uid);
    try {
        await updateDoc(userDocRef, { credits: newCredits }); // Update 'credits' field
        console.log(Date.now(), `updateCreditsInFirestore: Credits updated in Firestore to: ${newCredits} for user ${currentUser.uid}.`);
    } catch (error) {
        console.error(Date.now(), "updateCreditsInFirestore: FIRESTORE ERROR updating credits:", error);
        setError(`Failed to update credits in database: ${error.message}. Check Firebase rules and network.`);
        showToast(`Failed to update credits in database. Check console.`, "error", 7000);
        // Do NOT revert credit here. The local `currentCredits` is already decremented.
        // If Firestore update failed, the user might get a free generation, but we've logged it.
        // Reverting here would cause an infinite loop if the error persists.
    }
}

function updateUIForAuthStatus() {
    console.log(Date.now(), "updateUIForAuthStatus: Updating UI for auth status. Current user:", currentUser ? currentUser.displayName || currentUser.email : "None");

    if (userDisplayDesktop) {
        if (currentUser) {
            userDisplayDesktop.textContent = `Welcome, ${currentUser.displayName || currentUser.email}!`;
            userDisplayDesktop.classList.remove('hidden');
        } else {
            userDisplayDesktop.classList.add('hidden');
        }
    }
    if (signInBtnDesktop) signInBtnDesktop.classList.toggle('hidden', !!currentUser);
    if (signOutBtnDesktop) signOutBtnDesktop.classList.toggle('hidden', !currentUser);

    if (userDisplayMobile) {
        if (currentUser) {
            userDisplayMobile.textContent = `Welcome, ${currentUser.displayName || currentUser.email}!`;
            userDisplayMobile.classList.remove('hidden');
        } else {
            userDisplayMobile.classList.add('hidden');
        }
    }
    if (signInBtnMobile) signInBtnMobile.classList.toggle('hidden', !!currentUser);
    if (signOutBtnMobile) signOutBtnMobile.classList.toggle('hidden', !currentUser);

    console.log(Date.now(), "updateUIForAuthStatus: UI updated based on auth status.");
}

function populateAspectRatioRadios() {
    console.log(Date.now(), "populateAspectRatioRadios: Populating aspect ratio radios.");
    if (aspectRatioSelectionDiv) {
        aspectRatioSelectionDiv.innerHTML = '';
        ['1:1', '4:5', '9:16', '16:9'].forEach(ratio => {
            const label = document.createElement('label');
            label.className = 'inline-flex items-center cursor-pointer';
            label.innerHTML = `
                <input type="radio" name="aspectRatio" value="${ratio}" class="form-radio h-5 w-5 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500" ${aspectRatio === ratio ? 'checked' : ''}>
                <span class="ml-2 text-gray-200">${ratio}</span>
            `;
            const radioInput = label.querySelector('input');
            if (radioInput) {
                radioInput.addEventListener('change', (e) => {
                    aspectRatio = e.target.value;
                    console.log(Date.now(), "Event: Aspect ratio changed to:", aspectRatio);
                });
            }
            aspectRatioSelectionDiv.appendChild(label);
        });
        console.log(Date.now(), "populateAspectRatioRadios: Aspect ratio radios populated.");
    } else {
        console.error(Date.now(), "populateAspectRatioRadios: aspectRatioSelectionDiv element not found.");
    }
}

// --- Page Visibility Logic with GSAP Animations ---
async function setPage(newPage) {
    console.log(Date.now(), `setPage: Attempting to switch to page: ${newPage}. Current page: ${currentPage}`);
    if (currentPage === newPage) {
        console.log(Date.now(), `setPage: Already on page ${newPage}, no change needed.`);
        return;
    }

    const oldPageElement = getElement(`${currentPage}-page-element`);
    let newPageElement = getElement(`${newPage}-page-element`);

    if (oldPageElement) {
        console.log(Date.now(), `setPage: Fading out old page: ${currentPage} (Element ID: ${oldPageElement.id}).`);
        gsap.to(oldPageElement, {
            opacity: 0,
            y: 30,
            duration: 0.4,
            ease: "power2.in",
            onComplete: () => {
                oldPageElement.classList.add('hidden');
                oldPageElement.style.transform = ''; // Reset transform after animation
                console.log(Date.now(), `setPage: Old page (${oldPageElement.id}) hidden.`);
            }
        });
    }

    if (newPageElement) {
        console.log(Date.now(), `setPage: Attempting to show new page: ${newPage} (Element ID: ${newPageElement.id}).`);
        newPageElement.classList.remove('hidden');
        gsap.fromTo(newPageElement,
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", delay: 0.3, onComplete: () => {
                console.log(Date.now(), `setPage: New page (${newPageElement.id}) fully visible.`);
            }}
        );
    } else {
        console.error(Date.now(), `setPage: New page element for '${newPage}' not found.`);
    }

    currentPage = newPage;
    updateUI(); // Ensure UI updates after page switch
    console.log(Date.now(), `setPage: Page switched to: ${currentPage}.`);

    // Update active navigation link styles
    // Select all desktop nav buttons and remove active class
    document.querySelectorAll('#desktop-nav button').forEach(btn => {
        btn.classList.remove('text-blue-300');
        btn.classList.add('text-gray-100');
    });
    // Add active class to the currently selected desktop nav button
    const currentDesktopBtn = getElement(`${newPage}-btn`);
    if (currentDesktopBtn) {
        currentDesktopBtn.classList.remove('text-gray-100');
        currentDesktopBtn.classList.add('text-blue-300');
        console.log(Date.now(), `setPage: Applied active style to desktop nav button: ${currentDesktopBtn.id}`);
    }

    // Select all mobile nav buttons and remove active class
    document.querySelectorAll('#mobile-menu button.mobile-nav-link').forEach(btn => {
        btn.classList.remove('text-blue-300');
        btn.classList.add('text-gray-200'); // Assuming default mobile nav link color is gray-200
    });
    // Add active class to the currently selected mobile nav button
    const currentMobileBtn = getElement(`mobile-${newPage}-btn`);
    if (currentMobileBtn) {
        currentMobileBtn.classList.remove('text-gray-200');
        currentMobileBtn.classList.add('text-blue-300');
        console.log(Date.now(), `setPage: Applied active style to mobile nav button: ${currentMobileBtn.id}`);
    }
}

function updateUI() {
    console.log(Date.now(), `updateUI: Updating UI for current page: ${currentPage}. Auth Ready: ${isAuthReady}. Current Credits: ${currentCredits}`);

    const interactiveElements = [
        homeBtnDesktop, generatorBtnDesktop, pricingBtnDesktop, logoBtn,
        hamburgerBtn, closeMobileMenuBtn, mobileMenuOverlay,
        mobileHomeBtn, mobileGeneratorBtn, mobilePricingBtn,
        startCreatingBtn, promptInput, copyPromptBtn, clearPromptBtn, generateBtn,
        enhanceBtn, variationBtn, useEnhancedPromptBtn,
        downloadBtn, signInBtnDesktop, signOutBtnDesktop,
        signInBtnMobile, signOutBtnMobile, modalSignInBtn,
        closeSigninModalBtn, buyMoreCreditsModal, goToPricingBtn, closeBuyCreditsModalBtn
    ];

    interactiveElements.forEach(el => {
        if (el) {
            const isAuthButton = el.id && (el.id.includes('sign-in-btn') || el.id.includes('sign-out-btn') || el.id.includes('modal-sign-in-btn'));
            const isGeneratorButton = el.id && (el.id === 'generate-image-btn' || el.id === 'enhance-prompt-btn' || el.id === 'generate-variation-ideas-btn');
            const isPurchaseButton = el.dataset && el.dataset.planName;

            if (isAuthButton) {
                el.disabled = isSigningIn;
                el.classList.toggle('opacity-70', isSigningIn);
                el.classList.toggle('cursor-not-allowed', isSigningIn);
            } else if (isGeneratorButton) {
                // Generator buttons are disabled if not auth ready OR (no user AND no credits)
                const shouldDisableGenerator = !isAuthReady || (!currentUser && currentCredits <= 0);
                el.disabled = loading || loadingEnhancePrompt || loadingVariationIdeas || shouldDisableGenerator;
                el.classList.toggle('opacity-50', el.disabled);
                el.classList.toggle('cursor-not-allowed', el.disabled);
            } else if (isPurchaseButton) {
                el.disabled = !isAuthReady || loading;
                el.classList.toggle('opacity-50', el.disabled);
                el.classList.toggle('cursor-not-allowed', el.disabled);
            }
            else {
                el.disabled = !isAuthReady;
                el.classList.toggle('opacity-50', !isAuthReady);
                el.classList.toggle('cursor-not-allowed', !isAuthReady);
            }
        }
    });

    // Update active page styling for navigation buttons
    // This is now handled directly in setPage function to ensure consistency
    // across initial load and subsequent page changes.

    // Update credits display in header (desktop and mobile)
    if (creditsDisplay) {
        if (currentUser) {
            creditsDisplay.textContent = `Credits: ${currentCredits}`;
            creditsDisplay.classList.remove('text-red-400', 'text-gray-400');
            creditsDisplay.classList.add('text-green-400');
        } else {
            creditsDisplay.textContent = `Free: ${currentCredits}`;
            if (currentCredits <= 0) {
                creditsDisplay.classList.remove('text-green-400', 'text-gray-400');
                creditsDisplay.classList.add('text-red-400');
            } else {
                creditsDisplay.classList.remove('text-red-400', 'text-gray-400');
                creditsDisplay.classList.add('text-green-400');
            }
        }
    }
    // For mobile credits display
    if (creditsDisplayMobile) {
        if (currentUser) {
            creditsDisplayMobile.textContent = `Credits: ${currentCredits}`;
            creditsDisplayMobile.classList.remove('text-red-400', 'text-gray-400');
            creditsDisplayMobile.classList.add('text-green-400');
        } else {
            creditsDisplayMobile.textContent = `Free: ${currentCredits}`;
            if (currentCredits <= 0) {
                creditsDisplayMobile.classList.remove('text-green-400', 'text-gray-400');
                creditsDisplayMobile.classList.add('text-red-400');
            } else {
                creditsDisplayMobile.classList.remove('text-red-400', 'text-gray-400');
                creditsDisplayMobile.classList.add('text-green-400');
            }
        }
    }


    console.log(Date.now(), "updateUI: Header button states and credits updated.");

    if (currentPage === 'generator') {
        updateGeneratorPageUI();
    }
    updateUIForAuthStatus();
    console.log(Date.now(), "updateUI: Finished general UI update.");
}

function updateGeneratorPageUI() {
    console.log(Date.now(), "updateGeneratorPageUI: Updating dynamic generator UI.");
    if (promptInput) promptInput.value = prompt;

    // Credits display for generator page
    if (creditsDisplayGenerator) {
        if (currentUser) {
            creditsDisplayGenerator.textContent = `You have unlimited generations!`;
            creditsDisplayGenerator.classList.remove('text-red-400', 'text-gray-400');
            creditsDisplayGenerator.classList.add('text-green-400');
            console.log(Date.now(), "updateGeneratorPageUI: Displaying unlimited generations for authenticated user.");
        } else {
            creditsDisplayGenerator.textContent = `You have ${currentCredits} generations left without sign in.`;
            if (currentCredits <= 0) {
                creditsDisplayGenerator.classList.remove('text-green-400', 'text-gray-400');
                creditsDisplayGenerator.classList.add('text-red-400');
                console.log(Date.now(), "updateGeneratorPageUI: Displaying 0 generations left, red text.");
            } else {
                creditsDisplayGenerator.classList.remove('text-red-400', 'text-gray-400');
                creditsDisplayGenerator.classList.add('text-green-400');
                console.log(Date.now(), "updateGeneratorPageUI: Displaying free generations left, green text.");
            }
        }
    }

    populateAspectRatioRadios();

    if (generateBtn) {
        let buttonText = 'Generate Image';
        let loadingText = 'Generating...';

        if (!currentUser && currentCredits <= 0) {
            buttonText = 'Sign In or Buy More Credits'; // Updated text
        }

        generateBtn.innerHTML = loading ? `
            <span class="flex items-center justify-center">
                <svg class="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
                ${loadingText}
            </span>
        ` : buttonText;

        generateBtn.classList.toggle('bg-gray-700', loading);
        generateBtn.classList.toggle('cursor-not-allowed', loading);
        generateBtn.classList.toggle('bg-gradient-to-r', !loading);

        generateBtn.classList.remove('from-blue-700', 'to-indigo-800', 'hover:from-blue-800', 'hover:to-indigo-900',
                                   'from-red-600', 'to-red-700', 'hover:from-red-700', 'hover:to-red-800',
                                   'from-purple-600', 'to-purple-700', 'hover:from-purple-700', 'hover:to-purple-800'); // Removed old purple gradient

        if (loading) {
            // Handled above
        } else if (!currentUser && currentCredits <= 0) {
            generateBtn.classList.add('from-red-600', 'to-red-700', 'hover:from-red-700', 'hover:to-red-800');
            generateBtn.disabled = false; // Enable to allow clicking to buy more credits
        } else {
            generateBtn.classList.add('bg-purple-600', 'hover:bg-purple-700'); // Reverted to simple purple for consistency with original UI
            generateBtn.disabled = false;
        }
        console.log(Date.now(), "updateGeneratorPageUI: Generate button state updated.");
    }

    if (errorDisplay) {
        errorDisplay.textContent = currentError;
        errorDisplay.classList.toggle('hidden', !currentError);
        console.log(Date.now(), "updateGeneratorPageUI: Error display updated. Hidden:", !currentError);
    }

    if (imageDisplayContainer && generatedImageElement) {
        if (loading) {
            imageDisplayContainer.classList.add('hidden');
            console.log(Date.now(), "updateGeneratorPageUI: Image container hidden (loading).");
        } else if (imageUrl) {
            imageDisplayContainer.classList.remove('hidden');
            generatedImageElement.src = imageUrl;
            generatedImageElement.alt = `AI generated image based on prompt: ${prompt}`;
            generatedImageElement.style = getImageDisplayStyles();
            generatedImageElement.classList.add('animate-image-reveal');
            console.log(Date.now(), "updateGeneratorPageUI: Image container shown with new image.");
            console.log(Date.now(), "DEBUG: generatedImageElement.outerHTML:", generatedImageElement.outerHTML);
            console.log(Date.now(), "DEBUG: imageDisplayContainer.outerHTML:", imageDisplayContainer.outerHTML);
        } else {
            imageDisplayContainer.classList.add('hidden');
            console.log(Date.now(), "updateGeneratorPageUI: Image container hidden (no image).");
        }
    }

    if (enhanceBtn) {
        enhanceBtn.innerHTML = loadingEnhancePrompt ? `
            <span class="flex items-center justify-center">
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Enhancing...
            </span>
        ` : `<i class="fas fa-magic mr-2"></i> Enhance Prompt`;
        enhanceBtn.disabled = loadingEnhancePrompt;
        enhanceBtn.classList.toggle('opacity-70', loadingEnhancePrompt);
        enhanceBtn.classList.toggle('cursor-not-allowed', loadingEnhancePrompt);
        // Reverted to simple blue for consistency with original UI
        enhanceBtn.classList.toggle('bg-blue-600', !loadingEnhancePrompt);
        enhanceBtn.classList.toggle('hover:bg-blue-700', !loadingEnhancePrompt);
        console.log(Date.now(), "updateGeneratorPageUI: Enhance button state updated.");
    }

    if (enhancedPromptDisplay && enhancedPromptText) {
        enhancedPromptText.textContent = enhancedPrompt;
        enhancedPromptDisplay.classList.toggle('hidden', !enhancedPrompt);
        console.log(Date.now(), "updateGeneratorPageUI: Enhanced prompt display updated. Hidden:", !enhancedPrompt);
    }

    if (variationBtn) {
        variationBtn.innerHTML = loadingVariationIdeas ? `
            <span class="flex items-center justify-center">
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating Ideas...
            </span>
        ` : `<i class="fas fa-lightbulb mr-2"></i> Get Variation Ideas`;
        variationBtn.disabled = loadingVariationIdeas;
        variationBtn.classList.toggle('opacity-70', loadingVariationIdeas);
        variationBtn.classList.toggle('cursor-not-allowed', loadingVariationIdeas);
        // Reverted to simple green for consistency with original UI
        variationBtn.classList.toggle('bg-green-600', !loadingVariationIdeas);
        variationBtn.classList.toggle('hover:bg-green-700', !loadingVariationIdeas);
        console.log(Date.now(), "updateGeneratorPageUI: Variation ideas button state updated.");
    }

    if (variationIdeasDisplay && variationIdeasList) {
        variationIdeasList.innerHTML = variationIdeas.map(idea => `<li>${idea}</li>`).join('');
        variationIdeasDisplay.classList.toggle('hidden', variationIdeas.length === 0);
        console.log(Date.now(), "updateGeneratorPageUI: Variation ideas display updated. Hidden:", variationIdeas.length === 0);
    }
}

async function generateImage() {
    console.log(Date.now(), "generateImage: Function called.");
    clearError();

    if (!IMAGEN_GEMINI_API_KEY || IMAGEN_GEMINI_API_KEY === "YOUR_ACTUAL_GENERATED_API_KEY_HERE_PASTE_YOUR_KEY_HERE") {
        setError('API Key is not configured for image generation. Please replace "YOUR_ACTUAL_GENERATED_API_KEY_HERE_PASTE_YOUR_KEY_HERE" in script.js with your actual key obtained from Google Cloud Console and ensure the Imagen API is enabled.');
        updateUI();
        console.error(Date.now(), "generateImage: API Key not configured.");
        showToast("API Key missing for image generation. Check console.", "error");
        return;
    }

    if (!prompt.trim()) {
        setError('Please enter a prompt to generate an image.');
        updateUI();
        console.warn(Date.now(), "generateImage: Prompt is empty.");
        showToast("Please enter a prompt to generate an image.", "info");
        return;
    }

    console.log(Date.now(), `generateImage: Credits before decrement check: ${currentCredits}. Current User: ${currentUser ? 'Authenticated' : 'Unauthenticated'}`);
    if (!currentUser && currentCredits <= 0) { // Check for unauthenticated users only
        console.log(Date.now(), "generateImage: Credits exhausted for unauthenticated user. Showing sign-in/buy credits modal.");
        showModal(buyMoreCreditsModal); // Show the buy more credits modal
        updateUI();
        showToast("You've used all your free generations. Please sign in or buy more credits!", "info");
        return;
    }

    // Decrement credit BEFORE API call
    console.log(Date.now(), "generateImage: Attempting to decrement credit.");
    await decrementCredit();
    console.log(Date.now(), `generateImage: Credit decremented. Current credits: ${currentCredits}.`);
    showToast(`Generating image... ${currentUser ? 'credits' : 'free generations'} left: ${currentCredits}.`, "info");


    loading = true;
    imageUrl = '';
    updateUI();
    console.log(Date.now(), "generateImage: Starting image generation request.");
    console.time("imageGenerationAPI");

    try {
        let finalPrompt = prompt;
        const textKeywords = ['text', 'number', 'letter', 'font', 'word', 'digits', 'characters'];
        const containsTextKeyword = textKeywords.some(keyword => prompt.toLowerCase().includes(keyword));

        if (containsTextKeyword) {
            finalPrompt += ", clear, legible, sharp, high-resolution text, sans-serif font, precisely rendered, not distorted, no gibberish, accurate spelling, crisp edges";
            console.log(Date.now(), "generateImage: Added text-specific enhancements to prompt.");
        }

        let aspectRatioInstruction = '';
        switch (aspectRatio) {
            case '1:1': aspectRatioInstruction = ', square aspect ratio'; break;
            case '4:5': aspectRatioInstruction = ', portrait 4:5 aspect ratio'; break;
            case '9:16': aspectRatioInstruction = ', vertical 9:16 aspect ratio'; break;
            case '16:9': aspectRatioInstruction = ', horizontal 16:9 aspect ratio'; break;
        }
        finalPrompt += aspectRatioInstruction;
        console.log(Date.now(), "generateImage: Final prompt for API:", finalPrompt);


        const payload = { instances: { prompt: finalPrompt }, parameters: { "sampleCount": 1 } };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${IMAGEN_GEMINI_API_KEY}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log(Date.now(), "generateImage: API fetch response received.");

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API error: ${response.status} - ${errorData.error.message || 'Unknown error'}`);
        }

        const result = await response.json();
        console.log(Date.now(), "generateImage: API response parsed.", result);

        if (result.predictions && result.predictions.length > 0 && result.predictions[0].bytesBase64Encoded) {
            imageUrl = `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
            console.log(Date.now(), "generateImage: Image URL successfully created from Base64 data.");
            showToast("Image generated successfully!", "success");
        } else {
            setError('Failed to generate image. No image data received.');
            showToast('Failed to generate image. No data received.', "error");
            console.error(Date.now(), 'generateImage: API response missing image data:', result);
        }
    } catch (e) {
        setError(`An error occurred during image generation: ${e.message || 'Unknown error'}. Please try again.`);
        showToast(`Image generation failed: ${e.message}`, "error");
        console.error(Date.now(), 'generateImage: Error during image generation:', e);
        // Increment back the credit ONLY if it was a paid generation or if it was a free generation that failed
        // For simplicity, we'll refund if any generation fails.
        console.log(Date.now(), "generateImage: Attempting to increment credit due to generation failure.");
        await incrementCredit(); // Increment back the credit
        console.log(Date.now(), `generateImage: Credit refunded. Current credits: ${currentCredits}.`);
        showToast(`Credit refunded due to generation failure. You now have ${currentCredits} credits.`, "info", 5000);
    } finally {
        console.timeEnd("imageGenerationAPI");
        loading = false;
        updateUI();
        console.log(Date.now(), "generateImage: Image generation process finished (loading state reset).");
    }
}

async function decrementCredit() {
    console.log(Date.now(), `decrementCredit: Function called. Before decrement, currentCredits: ${currentCredits}`);
    if (currentUser) {
        // For authenticated users, decrement credits in Firestore
        currentCredits--;
        console.log(Date.now(), `decrementCredit: Authenticated user. New local credits: ${currentCredits}. Calling updateCreditsInFirestore.`);
        await updateCreditsInFirestore(currentCredits); // This function has its own error handling
    } else {
        // For unauthenticated users, decrement credits in localStorage
        currentCredits--;
        localStorage.setItem('unauthenticatedCredits', currentCredits);
        console.log(Date.now(), `decrementCredit: Unauthenticated user. Credits updated in localStorage. New value: ${localStorage.getItem('unauthenticatedCredits')}`);
    }
    updateUI();
    console.log(Date.now(), `decrementCredit: UI updated. Displayed credits: ${creditsDisplay?.textContent}`);
}

async function incrementCredit() {
    console.log(Date.now(), `incrementCredit: Function called. Before increment, currentCredits: ${currentCredits}`);
    if (currentUser) {
        // For authenticated users, increment credits in Firestore
        currentCredits++;
        console.log(Date.now(), `incrementCredit: Authenticated user. New local credits: ${currentCredits}. Calling updateCreditsInFirestore.`);
        await updateCreditsInFirestore(currentCredits); // This function has its own error handling
    } else {
        // For unauthenticated users, increment credits in localStorage
        currentCredits++;
        localStorage.setItem('unauthenticatedCredits', currentCredits);
        console.log(Date.now(), `incrementCredit: Unauthenticated user. Credits updated in localStorage. New value: ${localStorage.getItem('unauthenticatedCredits')}`);
    }
    updateUI();
    console.log(Date.now(), `incrementCredit: UI updated. Displayed credits: ${creditsDisplay?.textContent}`);
}


function downloadImage() {
    console.log(Date.now(), "downloadImage: Function called.");
    if (imageUrl) {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = 'generated_image.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Image downloaded!", "success");
        console.log(Date.now(), "downloadImage: Image download initiated.");
    } else {
        showToast("No image to download.", "info");
        console.warn(Date.now(), "downloadImage: No image URL available to download.");
    }
}

function copyToClipboard(text) {
    console.log(Date.now(), "copyToClipboard: Attempting to copy text.");
    if (!text) {
        showToast("Nothing to copy!", "info");
        return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showToast("Prompt copied to clipboard!", "success");
            console.log(Date.now(), "copyToClipboard: Text successfully copied.");
        } else {
            throw new Error('execCommand failed');
        }
    } catch (err) {
        console.error(Date.now(), 'copyToClipboard: Failed to copy text using execCommand:', err);
        try {
            navigator.clipboard.writeText(text).then(() => {
                showToast("Prompt copied to clipboard!", "success");
                console.log(Date.now(), "copyToClipboard: Text successfully copied using Clipboard API.");
            }).catch(clipboardErr => {
                console.error(Date.now(), 'copyToClipboard: Failed to copy text using Clipboard API:', clipboardErr);
                showToast("Failed to copy prompt. Please try manually.", "error");
            });
        } catch (apiErr) {
            console.error(Date.now(), 'copyToClipboard: Clipboard API not available or failed:', apiErr);
            showToast("Failed to copy prompt. Please try manually.", "error");
        }
    }
    document.body.removeChild(textarea);
}

async function enhancePrompt() {
    console.log(Date.now(), "enhancePrompt: Function called.");
    clearError();

    if (!IMAGEN_GEMINI_API_KEY || IMAGEN_GEMINI_API_KEY === "YOUR_ACTUAL_GENERATED_API_KEY_HERE_PASTE_YOUR_KEY_HERE") {
        setError('API Key is not configured for prompt enhancement. Please replace "YOUR_ACTUAL_GENERATED_API_KEY_HERE_PASTE_YOUR_KEY_HERE" in script.js with your actual key obtained from Google Cloud Console and ensure the Generative Language API is enabled.');
        updateUI();
        console.error(Date.now(), "enhancePrompt: API Key not configured.");
        showToast("API Key missing for prompt enhancement. Check console.", "error");
        return;
    }
    if (!prompt.trim()) {
        setError('Please enter a prompt to enhance.');
        updateUI();
        console.warn(Date.now(), "enhancePrompt: Prompt is empty.");
        showToast("Please enter a prompt to enhance.", "info");
        return;
    }
    loadingEnhancePrompt = true;
    enhancedPrompt = '';
    updateUI();
    console.log(Date.now(), "enhancePrompt: Starting prompt enhancement request.");
    showToast("Enhancing prompt...", "info");
    console.time("enhancePromptAPI");

    try {
        const llmPrompt = `Elaborate on the following image generation prompt to make it more descriptive and detailed, suitable for an advanced AI image generator. Add elements like lighting, mood, specific details, or artistic styles. Keep it concise, around 1-3 sentences.
        Original prompt: "${prompt}"`;

        let chatHistoryForEnhance = [];
        chatHistoryForEnhance.push({ role: "user", parts: [{ text: llmPrompt }] });
        const payload = { contents: chatHistoryForEnhance };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${IMAGEN_GEMINI_API_KEY}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log(Date.now(), "enhancePrompt: API fetch response received.");

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API error: ${response.status} - ${errorData.error.message || 'Unknown error'}`);
        }

        const result = await response.json();
        console.log(Date.now(), "enhancePrompt: API response parsed.", result);
        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            enhancedPrompt = result.candidates[0].content.parts[0].text;
            console.log(Date.now(), "enhancePrompt: Prompt successfully enhanced.");
            showToast("Prompt enhanced!", "success");
        } else {
            setError("Failed to enhance prompt. Please try again.");
            showToast("Failed to enhance prompt.", "error");
            console.error(Date.now(), "enhancePrompt: API response missing enhanced prompt data:", result);
        }
    } catch (e) {
        setError(`Error enhancing prompt: ${e.message}`);
        showToast(`Prompt enhancement failed: ${e.message}`, "error");
        console.error(Date.now(), "enhancePrompt: Error enhancing prompt:", e);
    } finally {
        console.timeEnd("enhancePromptAPI");
        loadingEnhancePrompt = false;
        updateUI();
        console.log(Date.now(), "enhancePrompt: Prompt enhancement process finished (loading state reset).");
    }
}

async function generateVariationIdeas() {
    console.log(Date.now(), "generateVariationIdeas: Function called.");
    clearError();

    if (!IMAGEN_GEMINI_API_KEY || IMAGEN_GEMINI_API_KEY === "YOUR_ACTUAL_GENERATED_API_KEY_HERE_PASTE_YOUR_KEY_HERE") {
        setError('API Key is not configured for variation ideas. Please replace "YOUR_ACTUAL_GENERATED_API_KEY_HERE_PASTE_YOUR_KEY_HERE" in script.js with your actual key obtained from Google Cloud Console and ensure the Generative Language API is enabled.');
        updateUI();
        console.error(Date.now(), "generateVariationIdeas: API Key not configured.");
        showToast("API Key missing for variation ideas. Check console.", "error");
        return;
    }
    if (!prompt.trim()) {
        setError('Please enter a prompt to get variation ideas.');
        updateUI();
        console.warn(Date.now(), "generateVariationIdeas: Prompt is empty.");
        showToast("Please enter a prompt to get variation ideas.", "info");
        return;
    }
    loadingVariationIdeas = true;
    variationIdeas = [];
    updateUI();
    console.log(Date.now(), "generateVariationIdeas: Starting variation ideas request.");
    showToast("Generating variation ideas...", "info");
    console.time("generateVariationIdeasAPI");

    try {
        const llmPrompt = `Given the image generation prompt: "${prompt}", suggest 3-5 distinct creative variations or alternative ideas for generating similar but unique images. Focus on changing elements like setting, time of day, artistic style, or subject perspective. List each idea concisely.`;

        let chatHistoryForVariations = [];
        chatHistoryForVariations.push({ role: "user", parts: [{ text: llmPrompt }] });
        const payload = { contents: chatHistoryForVariations };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${IMAGEN_GEMINI_API_KEY}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log(Date.now(), "generateVariationIdeas: API fetch response received.");

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API error: ${response.status} - ${errorData.error.message || 'Unknown error'}`);
        }

        const result = await response.json();
        console.log(Date.now(), "generateVariationIdeas: API response parsed.", result);
        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            const ideasText = result.candidates[0].content.parts[0].text;
            variationIdeas = ideasText.split('\n').filter(line => line.trim() !== '');
            console.log(Date.now(), "generateVariationIdeas: Variation ideas successfully generated.");
            showToast("Variation ideas generated!", "success");
        } else {
            setError("Failed to generate variation ideas. Please try again.");
            showToast("Failed to generate variation ideas.", "error");
            console.error(Date.now(), "generateVariationIdeas: API response missing variation ideas data:", result);
        }
    } catch (e) {
        setError(`Error generating variation ideas: ${e.message}`);
        showToast(`Variation ideas failed: ${e.message}`, "error");
        console.error(Date.now(), "generateVariationIdeas: Error generating variation ideas:", e);
    } finally {
        console.timeEnd("generateVariationIdeasAPI");
        loadingVariationIdeas = false;
        updateUI();
        console.log(Date.now(), "generateVariationIdeas: Variation ideas process finished (loading state reset).");
    }
}

function getImageDisplayStyles() {
    switch (aspectRatio) {
        case '1:1': return 'width: 100%; height: auto; aspect-ratio: 1 / 1;';
        case '4:5': return 'width: 100%; height: auto; aspect-ratio: 4 / 5;';
        case '9:16': return 'width: 100%; height: auto; aspect-ratio: 9 / 16;';
        case '16:9': return 'width: 100%; height: auto; aspect-ratio: 16 / 9;';
        default: return 'width: 100%; height: auto;';
    }
}

// --- Razorpay Integration Functions ---
async function initiateRazorpayPayment(plan) {
    console.log(Date.now(), `initiateRazorpayPayment: Initiating payment for plan: ${plan.name}`);
    clearError();

    if (!currentUser) {
        showToast("Please sign in to purchase credits.", "info");
        showModal(signinRequiredModal);
        return;
    }

    if (!RAZORPAY_KEY_ID || RAZORPAY_KEY_ID === "rzp_live_YOUR_LIVE_KEY_ID_HERE") {
        setError('Razorpay Key ID is not configured in script.js. Please replace "rzp_live_YOUR_LIVE_KEY_ID_HERE" with your actual LIVE Key ID.');
        showToast("Razorpay not configured. Check console.", "error");
        return;
    }

    loading = true;
    updateUI();
    showToast(`Preparing payment for ${plan.name}...`, "info", 5000);

    try {
        console.log(Date.now(), "initiateRazorpayPayment: Calling Cloud Function 'createRazorpayOrder' to create order.");
        const createOrderCallable = httpsCallable(functions, 'createRazorpayOrder');
        const orderResult = await createOrderCallable({
            amount: plan.price * 100, // Amount in paisa/cents
            currency: 'USD', // Or 'INR' if you are in India
            planName: plan.name,
            credits: plan.credits
        });
        const orderId = orderResult.data.orderId;

        if (!orderId) {
            throw new Error("Cloud Function did not return a valid Razorpay Order ID.");
        }
        console.log(Date.now(), `initiateRazorpayPayment: Received Order ID from Cloud Function: ${orderId}`);

        const options = {
            key: RAZORPAY_KEY_ID,
            amount: plan.price * 100,
            currency: 'USD',
            name: 'GenArt',
            description: `Purchase ${plan.name} Credits`,
            image: 'https://placehold.co/100x100/333333/FFFFFF?text=GA', // Placeholder image for Razorpay checkout
            order_id: orderId,
            handler: async function (response) {
                console.log(Date.now(), "Razorpay Handler: Payment successful. Response:", response);
                showToast("Payment successful! Verifying and updating your credits...", "success", 5000);

                try {
                    const verifyPaymentCallable = httpsCallable(functions, 'verifyRazorpayPayment');
                    const verificationResult = await verifyPaymentCallable({
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature,
                        planName: plan.name,
                        credits: plan.credits
                    });

                    if (verificationResult.data.success) {
                        console.log(Date.now(), "Razorpay Handler: Payment successfully verified by Cloud Function.");
                        currentCredits += plan.credits;
                        await updateCreditsInFirestore(currentCredits); // Update credits in Firestore
                        showToast(`Credits added! You now have ${currentCredits} credits.`, "success", 7000);
                        setPage('generator'); // Redirect to generator page after successful purchase
                    } else {
                        throw new Error(verificationResult.data.message || "Payment verification failed by Cloud Function.");
                    }
                } catch (verificationError) {
                    console.error(Date.now(), "Razorpay Handler: Error during Cloud Function verification:", verificationError);
                    setError(`Payment verification failed: ${verificationError.message}. Please contact support.`);
                    showToast(`Payment verification failed: ${verificationError.message}`, "error", 10000);
                }
            },
            prefill: {
                name: currentUser.displayName || '',
                email: currentUser.email || '',
                contact: ''
            },
            notes: {
                address: "GenArt Office",
                userId: currentUser.uid
            },
            theme: {
                color: '#60a5fa' // Tailwind blue-400
            }
        };

        const rzp1 = new Razorpay(options);

        rzp1.on('payment.failed', function (response) {
            console.error(Date.now(), "Razorpay Event: Payment failed.", response);
            setError(`Payment failed: ${response.error.description || 'Unknown error'}. Please try again.`);
            showToast(`Payment failed: ${response.error.description || 'Unknown error'}`, "error", 7000);
        });

        rzp1.on('modal.close', function () {
            console.log(Date.now(), "Razorpay Event: Payment modal closed by user.");
            showToast("Payment cancelled.", "info");
        });

        rzp1.open();
        console.log(Date.now(), "initiateRazorpayPayment: Razorpay modal opened.");

    } catch (e) {
        console.error(Date.now(), "initiateRazorpayPayment: Error initiating Razorpay payment:", e);
        setError(`Could not initiate payment: ${e.message}. Please try again.`);
        showToast(`Could not initiate payment: ${e.message}`, "error");
    } finally {
        loading = false;
        updateUI();
    }
}

function setError(message) {
    console.error(Date.now(), "setError: Setting error:", message);
    currentError = message;
}

function clearError() {
    console.log(Date.now(), "clearError: Clearing error.");
    currentError = '';
}

// --- Modal Show/Hide Functions with GSAP ---
function showModal(modalElement) {
    if (modalElement) {
        modalElement.classList.remove('hidden');
        gsap.fromTo(modalElement, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out", onComplete: () => {
            modalElement.classList.add('show-modal'); // Add this class to keep it visible
        }});
        gsap.fromTo(modalElement.querySelector('div'),
            { scale: 0.95 },
            { scale: 1, duration: 0.3, ease: "back.out(1.7)", delay: 0.1 }
        );
        console.log(Date.now(), `showModal: Displaying modal: ${modalElement.id}`);
    }
}

function hideModal(modalElement) {
    if (modalElement) {
        modalElement.classList.remove('show-modal'); // Remove class to start fade out
        gsap.to(modalElement.querySelector('div'),
            { scale: 0.95, duration: 0.2, ease: "power2.in" }
        );
        gsap.to(modalElement, {
            opacity: 0,
            duration: 0.3,
            ease: "power2.in",
            onComplete: () => modalElement.classList.add('hidden')
        });
        console.log(Date.now(), `hideModal: Hiding modal: ${modalElement.id}`);
    }
}


// --- Event Listeners Setup ---
function setupEventListeners() {
    console.log(Date.now(), "setupEventListeners: Setting up all event listeners...");

    homeBtnDesktop = getElement('home-btn');
    if (homeBtnDesktop) {
        homeBtnDesktop.addEventListener('click', () => { console.log(Date.now(), "Event: Desktop Home button clicked."); setPage('home'); });
        console.log(Date.now(), "Event Listener Attached: home-btn");
    }

    generatorBtnDesktop = getElement('generator-btn');
    if (generatorBtnDesktop) {
        generatorBtnDesktop.addEventListener('click', () => { console.log(Date.now(), "Event: Desktop Generator button clicked."); setPage('generator'); });
        console.log(Date.now(), "Event Listener Attached: generator-btn");
    }

    pricingBtnDesktop = getElement('pricing-btn'); // NEW: Pricing desktop button
    if (pricingBtnDesktop) {
        pricingBtnDesktop.addEventListener('click', () => { console.log(Date.now(), "Event: Desktop Pricing button clicked."); setPage('pricing'); });
        console.log(Date.now(), "Event Listener Attached: pricing-btn");
    }

    if (logoBtn) {
        logoBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Logo button clicked."); setPage('home'); });
        console.log(Date.now(), "Event Listener Attached: logoBtn");
    }

    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Hamburger button clicked."); toggleMobileMenu(); });
        console.log(Date.now(), "Event Listener Attached: hamburgerBtn");
    }

    if (closeMobileMenuBtn) {
        closeMobileMenuBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Close Mobile Menu button clicked."); toggleMobileMenu(); });
        console.log(Date.now(), "Event Listener Attached: closeMobileMenuBtn");
    }

    if (mobileMenuOverlay) {
        mobileMenuOverlay.addEventListener('click', () => {
            console.log(Date.now(), "Event: Mobile menu overlay clicked.");
            if (mobileMenu?.classList.contains('translate-x-0')) {
                toggleMobileMenu();
            }
        });
        console.log(Date.now(), "Event Listener Attached: mobileMenuOverlay");
    }

    mobileHomeBtn = getElement('mobile-home-btn');
    mobileGeneratorBtn = getElement('mobile-generator-btn');
    mobilePricingBtn = getElement('mobile-pricing-btn'); // NEW: Mobile pricing button

    if (mobileHomeBtn) {
        mobileHomeBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Mobile Home button clicked."); setPage('home'); toggleMobileMenu(); });
        console.log(Date.now(), "Event Listener Attached: mobile-home-btn");
    }
    if (mobileGeneratorBtn) {
        mobileGeneratorBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Mobile Generator button clicked."); setPage('generator'); toggleMobileMenu(); });
        console.log(Date.now(), "Event Listener Attached: mobile-generator-btn");
    }
    if (mobilePricingBtn) { // NEW: Mobile pricing button listener
        mobilePricingBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Mobile Pricing button clicked."); setPage('pricing'); toggleMobileMenu(); });
        console.log(Date.now(), "Event Listener Attached: mobile-pricing-btn");
    }

    if (startCreatingBtn) {
        startCreatingBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Start Creating Now button clicked."); setPage('generator'); });
        console.log(Date.now(), "Event Listener Attached: startCreatingBtn");
    }

    if (promptInput) {
        promptInput.addEventListener('input', (e) => {
            prompt = e.target.value;
            console.log(Date.now(), "Event: Prompt input changed. Current prompt:", prompt);
        });
        console.log(Date.now(), "Event Listener Attached: promptInput");
    }

    if (copyPromptBtn) {
        copyPromptBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Copy Prompt button clicked."); copyToClipboard(promptInput.value); });
        console.log(Date.now(), "Event Listener Attached: copyPromptBtn");
    }

    if (clearPromptBtn) {
        clearPromptBtn.addEventListener('click', () => {
            console.log(Date.now(), "Event: Clear Prompt button clicked.");
            promptInput.value = '';
            prompt = '';
            showToast("Prompt cleared!", "info");
            updateUI();
        });
        console.log(Date.now(), "Event Listener Attached: clearPromptBtn");
    }

    if (generateBtn) {
        generateBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Generate Image button clicked."); generateImage(); });
        console.log(Date.now(), "Event Listener Attached: generateBtn");
    }
    if (enhanceBtn) {
        enhanceBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Enhance Prompt button clicked."); enhancePrompt(); });
        console.log(Date.now(), "Event Listener Attached: enhanceBtn");
    }
    if (variationBtn) {
        variationBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Get Variation Ideas button clicked."); generateVariationIdeas(); });
        console.log(Date.now(), "Event Listener Attached: variationBtn");
    }

    if (useEnhancedPromptBtn) {
        useEnhancedPromptBtn.addEventListener('click', () => {
            console.log(Date.now(), "Event: Use Enhanced Prompt button clicked.");
            prompt = enhancedPrompt;
            enhancedPrompt = '';
            updateUI();
            showToast("Enhanced prompt applied!", "success");
        });
        console.log(Date.now(), "Event Listener Attached: useEnhancedPromptBtn");
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Download Image button clicked."); downloadImage(); });
        console.log(Date.now(), "Event Listener Attached: downloadBtn");
    }

    // Auth Buttons
    if (signInBtnDesktop) {
        signInBtnDesktop.addEventListener('click', () => { console.log(Date.now(), "Event: Desktop Sign In button clicked."); signInWithGoogle(); });
        console.log(Date.now(), "Event Listener Attached: signInBtnDesktop");
    }
    if (signOutBtnDesktop) {
        signOutBtnDesktop.addEventListener('click', () => { console.log(Date.now(), "Event: Desktop Sign Out button clicked."); signOutUser(); });
        console.log(Date.now(), "Event Listener Attached: signOutBtnDesktop");
    }
    if (signInBtnMobile) {
        signInBtnMobile.addEventListener('click', () => { console.log(Date.now(), "Event: Mobile Sign In button clicked."); signInWithGoogle(); });
        console.log(Date.now(), "Event Listener Attached: signInBtnMobile");
    }
    if (signOutBtnMobile) {
        signOutBtnMobile.addEventListener('click', () => { console.log(Date.now(), "Event: Mobile Sign Out button clicked."); signOutUser(); });
        console.log(Date.now(), "Event Listener Attached: signOutBtnMobile");
    }
    if (modalSignInBtn) {
        modalSignInBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Modal Sign In button clicked."); signInWithGoogle(); });
        console.log(Date.now(), "Event Listener Attached: modalSignInBtn");
    }

    if (closeSigninModalBtn) {
        closeSigninModalBtn.addEventListener('click', () => {
            console.log(Date.now(), "Event: Close Sign-in Modal button clicked.");
            hideModal(signinRequiredModal);
        });
        console.log(Date.now(), "Event Listener Attached: closeSigninModalBtn");
    }

    if (closeDebugMessageBtn) {
        closeDebugMessageBtn.addEventListener('click', () => {
            console.log(Date.now(), "Event: Close Debug Message button clicked.");
            persistentDebugMessage?.classList.add('hidden');
        });
        console.log(Date.now(), "Event Listener Attached: closeDebugMessageBtn");
    }

    // NEW: Buy More Credits Modal buttons
    if (goToPricingBtn) {
        goToPricingBtn.addEventListener('click', () => {
            console.log(Date.now(), "Event: Go to Pricing button clicked from modal.");
            hideModal(buyMoreCreditsModal);
            setPage('pricing');
        });
        console.log(Date.now(), "Event Listener Attached: goToPricingBtn");
    }
    if (closeBuyCreditsModalBtn) {
        closeBuyCreditsModalBtn.addEventListener('click', () => {
            console.log(Date.now(), "Event: Close Buy Credits Modal button clicked.");
            hideModal(buyMoreCreditsModal);
        });
        console.log(Date.now(), "Event Listener Attached: closeBuyCreditsModalBtn");
    }

    // NEW: Pricing plan buttons
    const buyPixelPulseBtn = getElement('buy-pixel-pulse-btn');
    if (buyPixelPulseBtn) {
        buyPixelPulseBtn.addEventListener('click', () => initiateRazorpayPayment(plans['pixel-pulse']));
        console.log(Date.now(), "Event Listener Attached: buy-pixel-pulse-btn");
    }

    const buyVisionCrafterBtn = getElement('buy-vision-crafter-btn');
    if (buyVisionCrafterBtn) {
        buyVisionCrafterBtn.addEventListener('click', () => initiateRazorpayPayment(plans['vision-crafter']));
        console.log(Date.now(), "Event Listener Attached: buy-vision-crafter-btn");
    }

    const buyDreamForgeBtn = getElement('buy-dream-forge-btn');
    if (buyDreamForgeBtn) {
        buyDreamForgeBtn.addEventListener('click', () => initiateRazorpayPayment(plans['dream-forge']));
        console.log(Date.now(), "Event Listener Attached: buy-dream-forge-btn");
    }

    populateAspectRatioRadios();
    console.log(Date.now(), "setupEventListeners: All event listeners setup attempted.");
}

// --- Main application initialization function ---
function initApp() {
    console.log(Date.now(), "initApp: Starting application initialization.");
    console.time("AppInitialization");

    try {
        // Initialize Firebase services first
        initFirebase();

        // Populate UI Element References here, after DOM is ready
        homePageElement = getElement('home-page-element');
        generatorPageElement = getElement('generator-page-element');
        pricingPageElement = getElement('pricing-page-element'); // NEW: Get pricing page element
        allPageElements = [homePageElement, generatorPageElement, pricingPageElement].filter(Boolean); // Filter out nulls

        persistentDebugMessage = getElement('persistent-debug-message');
        closeDebugMessageBtn = getElement('close-debug-message-btn');

        promptInput = getElement('prompt-input');
        copyPromptBtn = getElement('copy-prompt-btn');
        clearPromptBtn = getElement('clear-prompt-btn');
        aspectRatioSelectionDiv = getElement('aspect-ratio-selection');
        generateBtn = getElement('generate-image-btn');
        enhanceBtn = getElement('enhance-prompt-btn');
        variationBtn = getElement('generate-variation-ideas-btn');
        useEnhancedPromptBtn = getElement('use-enhanced-prompt-btn');
        downloadBtn = getElement('download-image-btn');
        errorDisplay = getElement('error-display');
        imageDisplayContainer = getElement('image-display-container');
        generatedImageElement = getElement('generated-image');
        enhancedPromptDisplay = getElement('enhanced-prompt-display');
        enhancedPromptText = getElement('enhanced-prompt-text');
        variationIdeasDisplay = getElement('variation-ideas-display');
        variationIdeasList = getElement('variation-ideas-list');

        userDisplayDesktop = getElement('user-display-desktop');
        signInBtnDesktop = getElement('sign-in-btn-desktop');
        signOutBtnDesktop = getElement('sign-out-btn-desktop');
        userDisplayMobile = getElement('user-display-mobile');
        signInBtnMobile = getElement('sign-in-btn-mobile');
        signOutBtnMobile = getElement('sign-out-btn-mobile');
        creditsDisplay = getElement('credits-display'); // Desktop header credits
        creditsDisplayMobile = getElement('credits-display-mobile'); // Mobile header credits
        creditsDisplayGenerator = getElement('credits-display-generator'); // Generator page credits
        signinRequiredModal = getElement('signin-required-modal');
        modalSignInBtn = getElement('modal-sign-in-btn');
        closeSigninModalBtn = getElement('close-signin-modal-btn');
        startCreatingBtn = getElement('start-creating-btn');
        logoBtn = getElement('logo-btn');

        hamburgerBtn = getElement('hamburger-btn');
        hamburgerIcon = getElement('hamburger-icon');
        mobileMenu = getElement('mobile-menu');
        mobileMenuOverlay = getElement('mobile-menu-overlay');
        closeMobileMenuBtn = getElement('close-mobile-menu-btn');
        mobileNavLinks = document.querySelectorAll('#mobile-menu .mobile-nav-link'); // NodeList, not single element

        homeBtnDesktop = getElement('home-btn');
        generatorBtnDesktop = getElement('generator-btn');
        pricingBtnDesktop = getElement('pricing-btn'); // Desktop pricing button
        mobileHomeBtn = getElement('mobile-home-btn');
        mobileGeneratorBtn = getElement('mobile-generator-btn');
        mobilePricingBtn = getElement('mobile-pricing-btn'); // Mobile pricing button

        toastContainer = getElement('toast-container');

        buyMoreCreditsModal = getElement('buy-more-credits-modal'); // Buy more credits modal
        goToPricingBtn = getElement('go-to-pricing-btn'); // Go to pricing button in modal
        closeBuyCreditsModalBtn = getElement('close-buy-credits-modal-btn'); // Close button in modal

        console.log(Date.now(), "initApp: All UI element references obtained.");

        console.log(Date.now(), "initApp: Calling setupEventListeners().");
        setupEventListeners();
        console.log(Date.now(), "initApp: Calling setPage('home').");
        setPage('home'); // Set initial page
        updateUI(); // Initial UI update after all elements are ready and listeners are set up

        console.timeEnd("AppInitialization");
        console.log(Date.now(), "initApp: App initialization complete.");

    } catch (criticalError) {
        console.error(Date.now(), "CRITICAL ERROR: Uncaught error during initApp execution:", criticalError);
        document.body.innerHTML = `<div style="color: white; background-color: red; padding: 20px; text-align: center;">
            <h1>Application Failed to Load</h1>
            <p>A critical error occurred during startup. Please check your browser's console (F12) for details.</p>
            <p>Error: ${criticalError.message}</p>
        </div>`;
        if (persistentDebugMessage) {
            persistentDebugMessage.classList.remove('hidden');
            persistentDebugMessage.querySelector('p').textContent = `A critical error occurred during startup: ${criticalError.message}. Please open your browser's Developer Console (F12) and copy all messages to the AI for debugging.`;
        }
    }
}

// --- DOMContentLoaded Listener (Main entry point after DOM is ready) ---
document.addEventListener('DOMContentLoaded', () => {
    console.log(Date.now(), "script.js: DOMContentLoaded event listener triggered.");
    initApp(); // Call the main initialization function
});
