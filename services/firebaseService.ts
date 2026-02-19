
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  signInAnonymously,
  updateProfile as updateAuthProfile,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup
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
  onSnapshot,
  orderBy,
  limit,
  writeBatch,
  increment,
  serverTimestamp
} from "firebase/firestore";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "firebase/storage";
import { Trip, Booking, TripStatus, LiveLocation, DriverTransaction } from '../types';

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

export const authService = {
  signUp: async (email: string, password: string, name: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${name?.replace(/\s/g, '')}`;

      await updateAuthProfile(user, { displayName: name, photoURL: avatar });
      await sendEmailVerification(user);

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
            isOnboarded: false,
            isVerified: false,
            co2Saved: 0,
            moneySaved: 0,
            fuelSaved: 0,
            walletBalance: 0,
            earnings: 0,
            level: 1,
            createdAt: Date.now()
      });
      
      return { data: { user: user }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  },
  
  signIn: async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { data: { user: userCredential.user }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  },

  signInWithGoogle: async () => {
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
         await setDoc(userRef, {
              id: user.uid,
              uid: user.uid,
              name: user.displayName || 'Google User',
              email: user.email,
              avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
              role: "customer",
              isDriver: false,
              rating: 5.0,
              tripsCount: 0,
              isOnboarded: false,
              isVerified: false,
              co2Saved: 0,
              moneySaved: 0,
              fuelSaved: 0,
              walletBalance: 0,
              earnings: 0,
              level: 1,
              createdAt: Date.now()
        });
      }
      return { data: { user: user }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  },

  onAuthStateChange: (callback: (user: any) => void) => {
    return onAuthStateChanged(auth, (user) => {
        if (user) {
            callback({
                uid: user.uid,
                id: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                emailVerified: user.emailVerified,
            });
        } else {
            callback(null);
        }
    });
  },

  signOut: async () => {
    await signOut(auth);
  }
};

export const userService = {
  getUserProfile: async (uid: string) => {
    try {
      const userSnap = await getDoc(doc(db, "users", uid));
      if (userSnap.exists()) {
        const userData = userSnap.data();
        let driverVerificationStatus = 'NONE';
        try {
            const driverSnap = await getDoc(doc(db, "drivers", uid));
            if (driverSnap.exists()) {
                const status = driverSnap.data().verificationStatus;
                if (status === 'approved') driverVerificationStatus = 'VERIFIED';
                else if (status === 'pending') driverVerificationStatus = 'PENDING';
                else if (status === 'rejected') driverVerificationStatus = 'REJECTED';
            }
        } catch (e) {}
        return { data: { ...userData, driverVerificationStatus }, error: null };
      }
      return { data: null, error: "Profile not found" };
    } catch (error: any) {
      return { data: null, error };
    }
  },
  
  updateProfile: async (uid: string, data: any) => {
    try {
      await setDoc(doc(db, "users", uid), data, { merge: true });
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  topUpBalance: async (uid: string, amount: number) => {
    try {
      await updateDoc(doc(db, "users", uid), {
        walletBalance: increment(amount)
      });
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  }
};

export const tripService = {
  listenToTrips: (callback: (trips: Trip[]) => void) => {
    const q = query(collection(db, "trips"), where("status", "==", "OPEN"));
    return onSnapshot(q, (snapshot) => {
      const trips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trip));
      callback(trips);
    });
  },
  
  createTrip: async (tripData: any) => {
    try {
      const docRef = await addDoc(collection(db, "trips"), { ...tripData, createdAt: Date.now() });
      return { data: { id: docRef.id, ...tripData }, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }
};

export const bookingService = {
  createBooking: async (bookingData: any, paymentMethod: string) => {
    try {
      const batch = writeBatch(db);
      const bookingRef = doc(collection(db, "bookings"));
      const bookingPayload = {
        ...bookingData,
        id: bookingRef.id,
        riderId: bookingData.userId,
        driverId: bookingData.driverId,
        paymentMethod,
        status: 'CONFIRMED',
        createdAt: Date.now()
      };
      
      batch.set(bookingRef, bookingPayload);

      if (paymentMethod === 'WALLET') {
          batch.update(doc(db, "users", bookingData.userId), {
              walletBalance: increment(-(bookingData.amount + 5))
          });
      }

      // Decrement seats AND set status to FULL so it disappears from public pool
      const tripRef = doc(db, "trips", bookingData.tripId);
      batch.update(tripRef, { 
          availableSeats: increment(-1),
          status: 'FULL' 
      });

      batch.update(doc(db, "users", bookingData.userId), {
          tripsCount: increment(1),
          co2Saved: increment(0.8),
          moneySaved: increment(bookingData.amount * 0.5)
      });

      await batch.commit();
      return { data: bookingPayload, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  cancelBooking: async (bookingId: string, tripId: string, userId: string, refundAmount: number) => {
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "bookings", bookingId), { status: 'CANCELLED' });
      batch.update(doc(db, "trips", tripId), { 
        availableSeats: increment(1),
        status: 'OPEN' 
      });
      
      const bookingSnap = await getDoc(doc(db, "bookings", bookingId));
      if (bookingSnap.exists() && bookingSnap.data().paymentMethod !== 'DIRECT') {
          batch.update(doc(db, "users", userId), { walletBalance: increment(refundAmount) });
      }
      
      await batch.commit();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e };
    }
  },

  getActiveBooking: async (uid: string) => {
    try {
      // Adjusted to perform client-side sorting to avoid Firestore index requirement
      const q = query(
        collection(db, "bookings"), 
        where("riderId", "==", uid), 
        where("status", "==", "CONFIRMED")
      );
      
      const snap = await getDocs(q);
      if (snap.empty) return null;
      
      // Convert to Booking objects
      const bookings = snap.docs.map(doc => doc.data() as Booking);
      
      // Sort in memory (descending by createdAt)
      bookings.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      
      // Return the most recent one
      return bookings[0];
    } catch (error) {
      console.error("Error fetching active booking:", error);
      return null;
    }
  },

  getUserBookings: async (uid: string) => {
    const q = query(collection(db, "bookings"), where("riderId", "==", uid));
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as Booking);
  }
};

export const driverService = {
  recalculateEarnings: async (uid: string) => {
    const q = query(collection(db, "bookings"), where("driverId", "==", uid), where("status", "==", "CONFIRMED"));
    const snap = await getDocs(q);
    let total = 0;
    snap.forEach(doc => total += (doc.data().amount || 0));
    await updateDoc(doc(db, "users", uid), { earnings: total });
    return total;
  },

  getEarningsHistory: async (uid: string) => {
    const q = query(collection(db, "driver_transactions"), where("driverId", "==", uid), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return { data: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
  },

  redeemEarnings: async (uid: string, amount: number, bank: any) => {
    try {
      const batch = writeBatch(db);
      const txRef = doc(collection(db, "driver_transactions"));
      batch.set(txRef, {
          driverId: uid, amount, type: 'WITHDRAWAL', status: 'PROCESSING', createdAt: Date.now()
      });
      batch.update(doc(db, "users", uid), { earnings: 0 });
      await batch.commit();
      return { success: true };
    } catch (error: any) {
      return { success: false, error };
    }
  },

  saveBankDetails: async (uid: string, bank: any) => {
    try {
      await updateDoc(doc(db, "users", uid), { bankDetails: bank });
      return { success: true };
    } catch (error: any) {
      return { success: false, error };
    }
  }
};

export const locationService = {
  updateUserLocation: async (uid: string, loc: LiveLocation) => {
    await setDoc(doc(db, "live_locations", uid), { ...loc, updatedAt: Date.now() });
  },
  listenToUserLocation: (uid: string, callback: (loc: LiveLocation | null) => void) => {
    return onSnapshot(doc(db, "live_locations", uid), (snap) => {
      if (snap.exists()) callback(snap.data() as LiveLocation);
      else callback(null);
    });
  }
};

export const chatService = {
  ensureChatExists: async (id: string, participants: string[]) => {
    try {
      await setDoc(doc(db, "chats", id), { participants, lastMessage: "", updatedAt: serverTimestamp() }, { merge: true });
      return { success: true };
    } catch (error: any) {
      return { success: false, error };
    }
  },
  sendMessage: async (id: string, text: string) => {
    const user = auth.currentUser;
    if (!user) return { error: "Auth required" };
    await addDoc(collection(db, "chats", id, "messages"), { senderId: user.uid, text, timestamp: serverTimestamp() });
    await updateDoc(doc(db, "chats", id), { lastMessage: text, updatedAt: serverTimestamp() });
    return { success: true };
  },
  listenToMessages: (id: string, callback: (msgs: any[]) => void, errorCallback?: (error: any) => void) => {
    const q = query(collection(db, "chats", id, "messages"), orderBy("timestamp", "asc"));
    return onSnapshot(q, (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))), errorCallback);
  }
};

export const storageService = {
  uploadKYC: async (file: File, path: string) => {
    const storageRef = ref(storage, path);
    const snap = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snap.ref);
    return { url, error: null };
  }
};

export const kycService = {
  submitCustomerKYC: async (uid: string, data: any) => {
    await updateDoc(doc(db, "users", uid), { kycData: data, isVerified: false });
    return { error: null };
  },
  registerDriverBasicInfo: async (uid: string, data: any) => {
    await setDoc(doc(db, "drivers", uid), { ...data, verificationStatus: 'incomplete' }, { merge: true });
    return { success: true };
  },
  submitDriverKYC: async (uid: string, data: any) => {
    await updateDoc(doc(db, "drivers", uid), { licenseNumber: data.license, verificationStatus: 'pending' });
    await updateDoc(doc(db, "users", uid), { isDriver: true });
    return { error: null };
  }
};
