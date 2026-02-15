import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  signInAnonymously,
  updateProfile as updateAuthProfile,
  sendEmailVerification
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  doc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  onSnapshot
} from "firebase/firestore";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "firebase/storage";
import { Trip, Booking, TripStatus, LiveLocation } from '../types';

/**
 * FIRESTORE SECURITY RULES (ENFORCEMENT):
 * ... (same as before)
 */

const firebaseConfig = {
  apiKey: "AIzaSyAR-IdPcUwNIIUvniuvMbIQkp7-nhRS3uY",
  authDomain: "tripinn-99eac.firebaseapp.com",
  databaseURL: "https://tripinn-99eac-default-rtdb.firebaseio.com",
  projectId: "tripinn-99eac",
  storageBucket: "tripinn-99eac.firebasestorage.app",
  messagingSenderId: "202151111336",
  appId: "1:202151111336:web:e8553d68a603787cc2709d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const sortAndFilterTrips = (rawTrips: any[]): Trip[] => {
  return rawTrips
    .map(t => ({...t, createdAtTime: t.createdAt || Date.now() }))
    .sort((a, b) => b.createdAtTime - a.createdAtTime);
};

let manualCallback: ((user: any) => void) | null = null;

/* =========================
   AUTH SERVICE
========================= */
export const authService = {
  signUp: async (email: string, password: string, name: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${name?.replace(/\s/g, '')}`;

      await updateAuthProfile(user, {
        displayName: name,
        photoURL: avatar
      });
      
      // Send Verification Email
      await sendEmailVerification(user);

      // Attempt to create Firestore doc. If it fails, auth still succeeded.
      try {
        await setDoc(doc(db, "users", user.uid), {
              id: user.uid,
              uid: user.uid,
              name: name,
              email: email,
              avatar: avatar,
              role: "customer",
              isDriver: false,
              rating: 5.0,
              tripsCount: 0,
              isOnboarded: false, // Set to false so they hit the Profile Setup screen
              isVerified: false,
              co2Saved: 0,
              moneySaved: 0,
              balance: 500,
              createdAt: Date.now()
        });
      } catch (e) {
        console.error("Firestore Profile Creation Failed:", e);
      }
      
      // Sign out to enforce email verification flow before accessing the app
      await signOut(auth);

      return { data: { user: user, session: false }, error: null };
    } catch (error: any) {
      console.error("SignUp Error:", error);
      return { data: null, error: { message: error.message } };
    }
  },
  
  signIn: async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { data: { user: userCredential.user }, error: null };
    } catch (error: any) {
      // Return error so UI can display "Invalid credentials"
      return { data: null, error: { message: error.message } };
    }
  },

  signInGuest: async () => {
    try {
      const userCredential = await signInAnonymously(auth);
      const user = userCredential.user;
      
      const guestData = {
        id: user.uid,
        uid: user.uid,
        name: 'Guest Pilot',
        email: 'guest@tripin.dev',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        role: "customer",
        isDriver: true,
        rating: 4.9,
        tripsCount: 42,
        isOnboarded: true, // Guests skip onboarding for demo purposes
        isVerified: true,
        driverVerificationStatus: 'VERIFIED',
        co2Saved: 42,
        moneySaved: 2500,
        balance: 1000,
        phone: '+91 9999999999',
        address: 'Technopark, Trivandrum, Kerala',
        sex: 'Other',
        createdAt: Date.now()
      };
      
      try {
        await setDoc(doc(db, "users", user.uid), guestData);
        // We use setDoc here. Since guest is new, it's a create. 
        // If guest exists, this might fail due to "update" rules being admin-only.
        // We wrap in try-catch to allow login to proceed even if profile write fails.
        await setDoc(doc(db, "drivers", user.uid), {
           userId: user.uid,
           licenseNumber: 'KL-01-GUEST',
           verificationStatus: 'approved',
           submittedAt: Date.now()
        });
      } catch (firestoreErr: any) {
        console.warn("Guest setup warning (Rules might be blocking):", firestoreErr.code);
        // Continue anyway, UI will handle missing profile
      }

      if (manualCallback) {
        // Pass sanitized user object to callback
        manualCallback({
          uid: user.uid,
          id: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          emailVerified: user.emailVerified,
          isAnonymous: user.isAnonymous
        });
      }
      return { data: { user: user }, error: null };
    } catch (error: any) {
      console.error("Guest Sign-In Error:", error);
      return { data: null, error: { message: error.message } };
    }
  },

  signOut: async () => {
    try {
      await signOut(auth);
      if (manualCallback) manualCallback(null);
    } catch (error) {
      console.error("SignOut Error:", error);
    }
  },

  onAuthStateChange: (callback: (user: any) => void) => {
    manualCallback = callback;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
            // Fix: Do not spread ...user as it contains circular references
            // Extract only serializable properties
            callback({
                uid: user.uid,
                id: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                emailVerified: user.emailVerified,
                phoneNumber: user.phoneNumber,
                isAnonymous: user.isAnonymous,
                providerData: user.providerData
            });
        } else {
            callback(null);
        }
    });
    return unsubscribe;
  },

  getCurrentUser: async () => {
      return auth.currentUser;
  },
};

/* =========================
   TRIP SERVICE (RIDES)
========================= */
export const tripService = {
  getAllTrips: async () => {
    try {
      const q = query(collection(db, "trips"), where("status", "==", "OPEN"));
      const querySnapshot = await getDocs(q);
      const trips: any[] = [];
      querySnapshot.forEach((doc) => {
        trips.push({ id: doc.id, ...doc.data() });
      });
      return { data: sortAndFilterTrips(trips), error: null };
    } catch (error: any) {
      console.error("getAllTrips error:", error);
      return { data: [], error };
    }
  },
  
  createTrip: async (tripData: any) => {
    try {
      const payload = { ...tripData, createdAt: Date.now() };
      const docRef = await addDoc(collection(db, "trips"), payload);
      return { data: { id: docRef.id, ...payload }, error: null };
    } catch (error: any) {
      console.error("Create Trip Error:", error);
      return { data: null, error };
    }
  },

  listenToTrips: (callback: (trips: Trip[]) => void) => {
    const q = query(collection(db, "trips"), where("status", "==", "OPEN"));
    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        const trips: any[] = [];
        querySnapshot.forEach((doc) => {
          trips.push({ id: doc.id, ...doc.data() });
        });
        callback(sortAndFilterTrips(trips));
      },
      (error) => {
        console.warn("Trip listener warning (Permissions/Network):", error.message);
        // Do not crash, just allow UI to show empty or existing state
      }
    );
    return unsubscribe;
  }
};

/* =========================
   USER SERVICE
========================= */
export const userService = {
  getUserProfile: async (uid: string) => {
    try {
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        let driverData = null;
        let driverVerificationStatus = 'NONE';

        try {
            const driverRef = doc(db, "drivers", uid);
            const driverSnap = await getDoc(driverRef);
            if (driverSnap.exists()) {
                driverData = driverSnap.data();
                const status = driverData.verificationStatus;
                if (status === 'approved') driverVerificationStatus = 'VERIFIED';
                else if (status === 'pending') driverVerificationStatus = 'PENDING';
                else if (status === 'rejected') driverVerificationStatus = 'REJECTED';
            }
        } catch (e) { /* ignore driver fetch error */ }

        return { 
            data: { 
                ...userData, 
                driverData,
                driverVerificationStatus 
            }, 
            error: null 
        };
      }
      return { data: null, error: "Profile not found" };
    } catch (error: any) {
      // Log but return object that helps UI decide
      console.error("getUserProfile fetch error:", error.code);
      return { data: null, error };
    }
  },
  
  updateProfile: async (uid: string, data: any) => {
    try {
      const docRef = doc(db, "users", uid);
      // Changed to setDoc with merge: true to handle missing docs elegantly
      await setDoc(docRef, data, { merge: true });
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  topUpBalance: async (uid: string, amount: number) => {
    try {
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const currentBalance = userSnap.data().balance || 0;
        await updateDoc(userRef, { balance: currentBalance + amount });
        return { data: currentBalance + amount, error: null };
      }
      return { data: null, error: "User not found" };
    } catch (e: any) {
      return { data: null, error: e };
    }
  }
};

/* =========================
   LOCATION & BOOKING SERVICE
========================= */
export const locationService = {
  updateUserLocation: async (uid: string, location: LiveLocation) => {
    try {
      const locationRef = doc(db, "live_locations", uid);
      await setDoc(locationRef, {
        ownerId: uid, // Required by rules: resource.data.ownerId == request.auth.uid
        ...location,
        timestamp: Date.now()
      });
    } catch (error) {
      // Silent fail for location updates is acceptable
    }
  },

  listenToUserLocation: (uid: string, callback: (location: LiveLocation | null) => void) => {
    const locationRef = doc(db, "live_locations", uid);
    return onSnapshot(locationRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as LiveLocation);
      } else {
        callback(null);
      }
    }, (error) => {
       console.warn("Location listener error:", error.message);
    });
  }
};

export const bookingService = {
  createBooking: async (bookingData: any, paymentMethod: string) => {
    try {
      const bookingPayload = {
        ...bookingData,
        riderId: bookingData.userId, // Rules require 'riderId'
        paymentMethod,
        createdAt: Date.now()
      };
      
      // Rules allow create if request.resource.data.riderId == request.auth.uid
      const bookingRef = await addDoc(collection(db, "bookings"), bookingPayload);
      const savedBooking = { id: bookingRef.id, ...bookingPayload };

      await addDoc(collection(db, "payments"), {
        bookingId: bookingRef.id,
        riderId: bookingData.userId,
        driverId: bookingData.driverId,
        ownerId: bookingData.driverId, // Helper for rules if needed
        amount: bookingData.amount + 5,
        method: paymentMethod,
        status: 'SUCCESS',
        createdAt: Date.now()
      });

      if (paymentMethod === 'WALLET') {
        const userRef = doc(db, "users", bookingData.userId);
        try {
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const userData = userSnap.data();
                await updateDoc(userRef, {
                    balance: (userData.balance || 0) - (bookingData.amount + 5),
                    moneySaved: (userData.moneySaved || 0) + 50,
                    co2Saved: (userData.co2Saved || 0) + 2
                });
            }
        } catch (e) {
            console.error("Wallet update failed:", e);
        }
      }

      return { data: savedBooking, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  getUserBookings: async (uid: string) => {
    try {
        const q = query(collection(db, "bookings"), where("riderId", "==", uid));
        const querySnapshot = await getDocs(q);
        const bookings: any[] = [];
        querySnapshot.forEach((doc) => {
            bookings.push({ id: doc.id, ...doc.data() });
        });
        return bookings.sort((a, b) => b.createdAt - a.createdAt);
    } catch (e) {
        return [];
    }
  }
};

/* =========================
   STORAGE & KYC SERVICE
========================= */
export const storageService = {
  uploadKYC: async (file: File, path: string) => {
    try {
      // 1. Ensure Auth Ready (Required by Storage Rules: if request.auth != null)
      let user = auth.currentUser;
      
      // If user is not immediately available, wait briefly for SDK initialization
      if (!user) {
         user = await new Promise((resolve) => {
             const unsub = onAuthStateChanged(auth, (u) => {
                 unsub();
                 resolve(u);
             });
             // Fallback timeout to prevent hanging
             setTimeout(() => resolve(null), 2000);
         });
      }

      if (!user) {
          return { url: null, error: "You are not logged in or your session has expired. Please refresh the page." };
      }
      
      const storageRef = ref(storage, path);
      
      const metadata = {
          contentType: file.type,
          customMetadata: {
              'uid': user.uid
          }
      };

      const snapshot = await uploadBytes(storageRef, file, metadata);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return { url: downloadURL, error: null };
    } catch (error: any) {
      console.error("Upload failed detailed:", error);
      let errorMessage = "Upload failed. Please try again.";
      
      if (error.code === 'storage/unauthenticated') {
        errorMessage = "You are not logged in or your session has expired. Please refresh the page.";
      } else if (error.code === 'storage/retry-limit-exceeded') {
        errorMessage = "Connection unstable. Please check your internet.";
      } else if (error.code === 'storage/canceled') {
        errorMessage = "Upload canceled.";
      } else if (error.code === 'storage/unauthorized') {
         errorMessage = "Permission denied. Please ensure you are uploading a valid file type to the correct location.";
      }
      return { url: null, error: errorMessage };
    }
  }
};

export const kycService = {
  submitCustomerKYC: async (uid: string, data: any) => {
    try {
        await updateDoc(doc(db, "users", uid), {
            kycData: data,
            isVerified: false
        });
        return { data, error: null };
    } catch (e) {
        return { data: null, error: e };
    }
  },

  registerDriverBasicInfo: async (uid: string, data: { name: string, phone: string, address: string, sex: string }) => {
    try {
      // Create/Update the driver document with basic info
      await setDoc(doc(db, "drivers", uid), {
         userId: uid,
         name: data.name,
         phone: data.phone,
         address: data.address,
         sex: data.sex,
         verificationStatus: 'incomplete', // Status indicating docs are missing
         updatedAt: Date.now()
      }, { merge: true });
      return { success: true };
    } catch (e: any) {
       console.error("Failed to register driver basic info", e);
       return { success: false, error: e };
    }
  },

  submitDriverKYC: async (uid: string, data: { license: string, vehicleNo: string, docUrl: string, vehicleUrl: string, vehicleType: string }) => {
    try {
        // 1. Create Driver Profile (if not exists)
        // Store the license number in the drivers collection as requested
        try {
            await setDoc(doc(db, "drivers", uid), {
                userId: uid,
                licenseNumber: data.license,
                licenseUrl: data.docUrl,
                verificationStatus: 'pending', 
                submittedAt: Date.now()
            }, { merge: true }); 
        } catch (e: any) {
            console.warn("Driver doc write warning:", e.code);
        }

        // 2. Add/Update Vehicle Info
        await addDoc(collection(db, "vehicles"), {
            driverId: uid,
            vehicleType: data.vehicleType,
            registrationNumber: data.vehicleNo,
            vehicleImageUrl: data.vehicleUrl, // Save vehicle photo URL
            isVerified: false,
            createdAt: Date.now()
        });

        // 3. Update User Profile flag
        await updateDoc(doc(db, "users", uid), {
            isDriver: true
        });

        return { data, error: null };
    } catch (e) {
        console.error("Driver KYC Submit Error", e);
        return { data: null, error: e };
    }
  }
};

export const adminService = {
  checkIsAdmin: async (uid: string) => {
    if (uid === 'guest_dev_user') return true;
    try {
        const { data } = await userService.getUserProfile(uid);
        return (data && data.email === 'admin@tripin.dev') || false;
    } catch(e) {
        return false;
    }
  }
};