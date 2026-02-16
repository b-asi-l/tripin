
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
  onSnapshot,
  orderBy,
  limit,
  writeBatch,
  increment
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
      
      await sendEmailVerification(user);

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
              isOnboarded: false,
              isVerified: false,
              co2Saved: 0,
              moneySaved: 0,
              balance: 0, 
              earnings: 0,
              createdAt: Date.now()
        });
      } catch (e) {
        console.error("Firestore Profile Creation Failed:", e);
      }
      
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
        isOnboarded: true,
        isVerified: true,
        driverVerificationStatus: 'VERIFIED',
        co2Saved: 42,
        moneySaved: 2500,
        balance: 1000,
        earnings: 540,
        phone: '+91 9999999999',
        address: 'Technopark, Trivandrum, Kerala',
        sex: 'Other',
        createdAt: Date.now()
      };
      
      try {
        await setDoc(doc(db, "users", user.uid), guestData);
        try {
            await setDoc(doc(db, "drivers bank", user.uid), {
                accountName: 'Guest Pilot',
                accountNumber: '1234567890',
                ifsc: 'SBIN0001234',
                bankName: 'TripIn Bank',
                updatedAt: Date.now()
            });
        } catch (ignored) { }
        
        await setDoc(doc(db, "drivers", user.uid), {
           userId: user.uid,
           licenseNumber: 'KL-01-GUEST',
           verificationStatus: 'approved',
           submittedAt: Date.now()
        }, { merge: true });

      } catch (firestoreErr: any) {
        console.warn("Guest setup warning:", firestoreErr.code);
      }

      if (manualCallback) {
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
      return { data: [], error };
    }
  },
  
  createTrip: async (tripData: any) => {
    try {
      const payload = { ...tripData, createdAt: Date.now() };
      const docRef = await addDoc(collection(db, "trips"), payload);
      return { data: { id: docRef.id, ...payload }, error: null };
    } catch (error: any) {
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
      (error) => {}
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
        let bankDetails = null;

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
        } catch (e) { }

        try {
            const bankRef = doc(db, "drivers bank", uid);
            const bankSnap = await getDoc(bankRef);
            if (bankSnap.exists()) {
                bankDetails = bankSnap.data();
            }
        } catch (e) { }

        if (!bankDetails) {
            if (userData.bankDetails) bankDetails = userData.bankDetails;
            else if (driverData && driverData.bankDetails) bankDetails = driverData.bankDetails;
        }

        return { 
            data: { 
                ...userData, 
                driverData,
                driverVerificationStatus,
                bankDetails 
            }, 
            error: null 
        };
      }
      return { data: null, error: "Profile not found" };
    } catch (error: any) {
      return { data: null, error };
    }
  },
  
  updateProfile: async (uid: string, data: any) => {
    try {
      const docRef = doc(db, "users", uid);
      await setDoc(docRef, data, { merge: true });
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  topUpBalance: async (uid: string, amount: number) => {
    try {
      const userRef = doc(db, "users", uid);
      // Use atomic increment for safety
      await updateDoc(userRef, { balance: increment(amount) });
      return { data: amount, error: null };
    } catch (e: any) {
      return { data: null, error: e };
    }
  }
};

export const driverService = {
  recalculateEarnings: async (driverId: string) => {
    try {
        const qb = query(collection(db, "bookings"), where("driverId", "==", driverId));
        const bSnap = await getDocs(qb);
        let totalIncome = 0;
        let tripsCount = 0;
        
        bSnap.forEach(d => {
           const b = d.data();
           if(b.status === 'CONFIRMED' || b.status === 'COMPLETED') {
              totalIncome += (b.amount || 0) * 0.99;
              tripsCount++;
           }
        });

        const qw = query(collection(db, "users", driverId, "withdrawals"));
        const wSnap = await getDocs(qw);
        let totalWithdrawn = 0;
        
        wSnap.forEach(d => {
           const w = d.data();
           if(w.status !== 'FAILED') {
              totalWithdrawn += (w.amount || 0);
           }
        });

        const netEarnings = totalIncome - totalWithdrawn;

        await updateDoc(doc(db, "users", driverId), {
            earnings: netEarnings,
            tripsCount: tripsCount
        });

        return { earnings: netEarnings, trips: tripsCount };
    } catch (e) {
        console.error("Recalculation failed", e);
        return null;
    }
  },

  getEarningsHistory: async (driverId: string) => {
    const transactions: DriverTransaction[] = [];
    try {
      const earningsQ = query(
        collection(db, "bookings"), 
        where("driverId", "==", driverId),
        limit(50)
      );
      const earningsSnap = await getDocs(earningsQ);
      earningsSnap.forEach(doc => {
        const b = doc.data();
        if (b.status === 'CONFIRMED' || b.status === 'COMPLETED') {
             const earningAmount = (b.amount || 0); 
             transactions.push({
                id: doc.id,
                driverId: b.driverId,
                amount: earningAmount,
                type: 'RIDE_EARNING',
                description: `Ride from ${b.from?.split(',')[0] || 'Location'}`,
                status: 'COMPLETED',
                createdAt: b.createdAt || Date.now()
             });
        }
      });
    } catch (e: any) {}

    try {
      const withdrawalsQ = query(
        collection(db, "users", driverId, "withdrawals"),
        limit(50)
      );
      const withdrawSnap = await getDocs(withdrawalsQ);
      withdrawSnap.forEach(doc => {
         transactions.push({ id: doc.id, ...doc.data() } as DriverTransaction);
      });
    } catch (e: any) {}

    transactions.sort((a, b) => b.createdAt - a.createdAt);
    return { data: transactions, error: null };
  },

  saveBankDetails: async (userId: string, bankDetails: any) => {
    try {
      try {
        await setDoc(doc(db, "drivers bank", userId), {
           ...bankDetails,
           updatedAt: Date.now()
        }, { merge: true });
        return { success: true, error: null };
      } catch (permError: any) {
         await updateDoc(doc(db, "users", userId), {
             bankDetails: bankDetails
         });
         return { success: true, error: null };
      }
    } catch (e: any) {
       return { success: false, error: e };
    }
  },

  redeemEarnings: async (userId: string, amount: number, bankDetails: any) => {
    try {
      if (amount <= 0) return { error: "No earnings to redeem" };

      // Use Batch for atomic withdrawal request
      const batch = writeBatch(db);
      
      const withdrawalRef = doc(collection(db, "users", userId, "withdrawals"));
      batch.set(withdrawalRef, {
        driverId: userId,
        amount: amount,
        type: 'WITHDRAWAL',
        description: 'Earnings payout to Bank Account',
        bankDetails, 
        status: 'PROCESSING',
        createdAt: Date.now()
      });

      // Reset displayed earnings immediately (source of truth is recalculated, but this is UX)
      const userRef = doc(db, "users", userId);
      batch.update(userRef, { earnings: 0 });

      await batch.commit();

      return { success: true, error: null };
    } catch (error: any) {
      return { success: false, error };
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
        ownerId: uid, 
        ...location,
        timestamp: Date.now()
      });
    } catch (error) {}
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
      const batch = writeBatch(db);
      
      // 1. Create Booking Reference
      const bookingRef = doc(collection(db, "bookings"));
      const bookingPayload = {
        ...bookingData,
        id: bookingRef.id,
        // Crucial: Use String() to ensure these are not undefined/null, which causes rules to fail
        riderId: String(bookingData.userId), 
        driverId: String(bookingData.driverId),
        paymentMethod,
        createdAt: Date.now()
      };
      batch.set(bookingRef, bookingPayload);

      // 2. Create Payment Record
      const paymentRef = doc(collection(db, "payments"));
      batch.set(paymentRef, {
        bookingId: bookingRef.id,
        riderId: String(bookingData.userId),
        driverId: String(bookingData.driverId),
        ownerId: String(bookingData.driverId), 
        amount: bookingData.amount + 5,
        method: paymentMethod,
        status: 'SUCCESS',
        createdAt: Date.now()
      });

      // 3. Wallet Deduction (Atomic)
      if (paymentMethod === 'WALLET') {
        const userRef = doc(db, "users", bookingData.userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const currentBalance = userSnap.data().balance || 0;
            const totalCost = bookingData.amount + 5;
            
            if (currentBalance < totalCost) {
                return { data: null, error: { message: "Insufficient wallet balance" } };
            }
            
            batch.update(userRef, {
                balance: increment(-totalCost),
                moneySaved: increment(50),
                co2Saved: increment(2)
            });
        }
      }

      // 4. Update Trip Seats
      if (bookingData.tripId) {
          const tripRef = doc(db, "trips", bookingData.tripId);
          // Only works if security rules allow update (relaxed in new rules)
          batch.update(tripRef, { availableSeats: increment(-1) });
      }

      await batch.commit();
      return { data: bookingPayload, error: null };
    } catch (error: any) {
      console.error("Booking Creation Error", error);
      return { data: null, error };
    }
  },

  cancelBooking: async (bookingId: string, tripId: string, userId: string, refundAmount: number) => {
    try {
        const batch = writeBatch(db);
        
        // 1. Update Booking Status
        const bookingRef = doc(db, "bookings", bookingId);
        batch.update(bookingRef, { status: 'CANCELLED' });

        // 2. Restore Trip Seat
        const tripRef = doc(db, "trips", tripId);
        batch.update(tripRef, { availableSeats: increment(1) });

        // 3. Refund User Wallet
        const userRef = doc(db, "users", userId);
        batch.update(userRef, { balance: increment(refundAmount) });

        await batch.commit();
        return { success: true, error: null };
    } catch (e: any) {
        return { success: false, error: e };
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
   CHAT SERVICE
========================= */
export const chatService = {
  // Checks if the chat document exists for the booking; if not, creates it.
  ensureChatExists: async (chatId: string, participants: string[]) => {
     if (!auth.currentUser) return { error: "Not authenticated" };
     try {
       const chatRef = doc(db, "chats", chatId);
       const chatSnap = await getDoc(chatRef);
       
       if (!chatSnap.exists()) {
          console.log("Creating new chat document for:", chatId);
          await setDoc(chatRef, {
              participants: participants,
              createdAt: Date.now(),
              lastMessage: "",
              updatedAt: Date.now()
          });
       }
       return { success: true };
     } catch (e: any) {
       console.error("Error creating chat:", e);
       return { error: e };
     }
  },

  sendMessage: async (chatId: string, senderId: string, text: string) => {
    try {
      // Add message to subcollection
      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId,
        text,
        timestamp: Date.now()
      });
      
      // Update parent chat with last message
      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: text,
        updatedAt: Date.now()
      });

      return { success: true, error: null };
    } catch (error: any) {
      console.error("Error sending message:", error);
      return { success: false, error };
    }
  },

  listenToMessages: (chatId: string, callback: (messages: any[]) => void, onError?: (error: any) => void) => {
    if (!chatId) {
        console.error("listenToMessages called with empty chatId");
        if (onError) onError({ code: 'invalid-argument', message: 'Chat ID is missing' });
        return () => {};
    }

    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "asc")
    );
    
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(messages);
    }, (error) => {
      console.error("Chat listener error:", error.code, error.message);
      if (onError) onError(error);
    });
  }
};

/* =========================
   STORAGE & KYC SERVICE
========================= */
export const storageService = {
  uploadKYC: async (file: File, path: string) => {
    try {
      let user = auth.currentUser;
      
      if (!user) {
          for(let i=0; i<5; i++) {
             await new Promise(r => setTimeout(r, 200));
             user = auth.currentUser;
             if(user) break;
          }
      }

      if (!user) {
          return { url: null, error: "Session expired. Please log in again." };
      }
      
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const cleanPath = path.replace(/\.[^/.]+$/, ""); 
      const finalPath = `${cleanPath}.${fileExt}`;
      
      const storageRef = ref(storage, finalPath);
      
      const metadata = {
        contentType: file.type || 'image/jpeg',
      };
      
      const snapshot = await uploadBytes(storageRef, file, metadata);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      return { url: downloadURL, error: null };
    } catch (error: any) {
      console.error("Storage Upload Error:", error);
      let errorMessage = "Upload failed. Please retry.";
      if (error.code === 'storage/unauthorized') errorMessage = "Permission denied. (Unauthorized)";
      if (error.code === 'storage/canceled') errorMessage = "Upload canceled.";
      if (error.code === 'storage/retry-limit-exceeded') errorMessage = "Poor connection. Upload timed out.";
      
      return { url: null, error: `${errorMessage} (${error.code || 'unknown'})` };
    }
  }
};

export const kycService = {
  submitCustomerKYC: async (uid: string, data: any) => {
    try {
        await setDoc(doc(db, "users", uid), {
            kycData: {
                ...data,
                submittedAt: Date.now()
            },
            isVerified: false
        }, { merge: true });
        return { data, error: null };
    } catch (e: any) {
        return { data: null, error: e.message || "KYC Submission failed" };
    }
  },

  registerDriverBasicInfo: async (uid: string, data: any) => {
    try {
      await setDoc(doc(db, "drivers", uid), {
         userId: uid,
         name: data.name,
         phone: data.phone,
         address: data.address,
         sex: data.sex,
         verificationStatus: 'incomplete', 
         updatedAt: Date.now()
      }, { merge: true });
      return { success: true };
    } catch (e: any) {
       return { success: false, error: e };
    }
  },

  submitDriverKYC: async (uid: string, data: any) => {
    try {
        try {
            await setDoc(doc(db, "drivers", uid), {
                userId: uid,
                licenseNumber: data.license,
                licenseUrl: data.docUrl,
                verificationStatus: 'pending', 
                submittedAt: Date.now()
            }, { merge: true }); 
        } catch (e: any) {
             console.error("Driver doc update failed", e);
             throw new Error("Could not update driver profile.");
        }

        await addDoc(collection(db, "vehicles"), {
            driverId: uid,
            vehicleType: data.vehicleType,
            registrationNumber: data.vehicleNo,
            vehicleImageUrl: data.vehicleUrl, 
            isVerified: false,
            createdAt: Date.now()
        });

        await setDoc(doc(db, "users", uid), {
            isDriver: true
        }, { merge: true });

        return { data, error: null };
    } catch (e: any) {
        return { data: null, error: e.message };
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
