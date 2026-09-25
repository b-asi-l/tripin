import { Trip, Booking, TripStatus, LiveLocation, DriverTransaction } from '../types';
import { supabase } from './supabaseClient';

export const authService = {
  signUp: async (email: string, password: string, name: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          }
        }
      });
      if (error) throw error;
      
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${name?.replace(/\s/g, '')}`;
      
      // Update the user record with the avatar (the trigger handles creation)
      if (data.user) {
        await supabase.from('users').update({ avatar, name, display_name: name }).eq('id', data.user.id);
      }
      
      return { data: { user: data.user }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  },
  
  signIn: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { data: { user: data.user }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  },

  signInWithGoogle: async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });
      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  },

  onAuthStateChange: (callback: (user: any) => void) => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        callback({
          uid: session.user.id,
          id: session.user.id,
          email: session.user.email,
          displayName: session.user.user_metadata?.full_name,
          emailVerified: !!session.user.email_confirmed_at || true,
        });
      } else {
        callback(null);
      }
    });
    
    // Also check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        callback({
          uid: session.user.id,
          id: session.user.id,
          email: session.user.email,
          displayName: session.user.user_metadata?.full_name,
          emailVerified: true,
        });
      }
    });

    return () => { subscription.unsubscribe(); };
  },

  signOut: async () => {
    await supabase.auth.signOut();
  }
};

export const userService = {
  getUserProfile: async (uid: string) => {
    try {
      const { data: userData, error } = await supabase.from('users').select('*').eq('id', uid).single();
      if (error) throw error;
      
      let driverVerificationStatus = 'NONE';
      const { data: driverData } = await supabase.from('drivers').select('verification_status').eq('id', uid).single();
      if (driverData) {
         const status = driverData.verification_status;
         if (status === 'approved') driverVerificationStatus = 'VERIFIED';
         else if (status === 'pending') driverVerificationStatus = 'PENDING';
         else if (status === 'rejected') driverVerificationStatus = 'REJECTED';
      }
      
      return { data: { ...userData, driverVerificationStatus }, error: null };
    } catch (error: any) {
      return { data: null, error: error.message };
    }
  },
  
  updateProfile: async (uid: string, data: any) => {
    try {
      const { data: updated, error } = await supabase.from('users').update(data).eq('id', uid).select().single();
      if (error) throw error;
      return { data: updated, error: null };
    } catch (error: any) {
      return { data: null, error: error.message };
    }
  },

  topUpBalance: async (uid: string, amount: number) => {
    try {
      // In a real app this would use an RPC call to avoid race conditions
      const { data } = await supabase.from('users').select('wallet_balance').eq('id', uid).single();
      const newBalance = (data?.wallet_balance || 0) + amount;
      await supabase.from('users').update({ wallet_balance: newBalance }).eq('id', uid);
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  }
};

export const tripService = {
  listenToTrips: (callback: (trips: Trip[]) => void) => {
    const mapTrips = (data: any[]) => data.map(t => ({
        id: t.id,
        ownerId: t.driver_id,
        ownerName: t.driver_name || 'Unknown Driver',
        ownerAvatar: t.driver_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${t.driver_id}`,
        ownerRating: 5.0,
        ownerPhone: 'N/A',
        from: t.origin?.address || 'Origin',
        to: t.destination?.address || 'Destination',
        date: new Date(t.departure_time).toLocaleDateString(),
        time: new Date(t.departure_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        vehicleType: t.car_model || 'CAR',
        pricePerSeat: t.price_per_seat,
        availableSeats: t.available_seats,
        status: t.status,
        description: '',
        requests: []
    } as Trip));

    supabase.from('trips').select('*').eq('status', 'OPEN').then(({ data }) => {
      if (data) callback(mapTrips(data));
    });

    const channel = supabase
      .channel('public:trips')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: "status=eq.OPEN" }, payload => {
         supabase.from('trips').select('*').eq('status', 'OPEN').then(({ data }) => {
            if (data) callback(mapTrips(data));
         });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },
  
  createTrip: async (tripData: any) => {
    try {
      const dbTrip = {
        driver_id: tripData.ownerId,
        driver_name: tripData.ownerName,
        driver_avatar: tripData.ownerAvatar,
        origin: { address: tripData.from },
        destination: { address: tripData.to },
        // Construct departure_time from string
        departure_time: new Date(`${tripData.date} ${tripData.time}`).getTime() || Date.now(),
        price_per_seat: tripData.pricePerSeat,
        available_seats: tripData.availableSeats,
        car_model: tripData.vehicleType,
        status: tripData.status || 'OPEN',
        created_at: Date.now()
      };
      
      const { data, error } = await supabase.from('trips').insert(dbTrip).select().single();
      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }
};

export const bookingService = {
  createBooking: async (bookingData: any, paymentMethod: string) => {
    try {
      const bookingPayload = {
        trip_id: bookingData.tripId,
        rider_id: bookingData.userId,
        driver_id: bookingData.driverId,
        amount: bookingData.amount,
        payment_method: paymentMethod,
        status: 'CONFIRMED',
        created_at: Date.now()
      };
      
      const { data: booking, error } = await supabase.from('bookings').insert(bookingPayload).select().single();
      if (error) throw error;

      if (paymentMethod === 'WALLET') {
          const { data: user } = await supabase.from('users').select('wallet_balance, trips_count, co2_saved, money_saved').eq('id', bookingData.userId).single();
          if (user) {
             await supabase.from('users').update({
                wallet_balance: user.wallet_balance - (bookingData.amount + 5),
                trips_count: user.trips_count + 1,
                co2_saved: user.co2_saved + 0.8,
                money_saved: user.money_saved + (bookingData.amount * 0.5)
             }).eq('id', bookingData.userId);
          }
      }

      const { data: trip } = await supabase.from('trips').select('available_seats').eq('id', bookingData.tripId).single();
      if (trip) {
         const newSeats = trip.available_seats - 1;
         await supabase.from('trips').update({ 
             available_seats: newSeats,
             status: newSeats <= 0 ? 'FULL' : 'OPEN'
         }).eq('id', bookingData.tripId);
      }

      return { data: { id: booking.id, ...bookingData, status: 'CONFIRMED' }, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  cancelBooking: async (bookingId: string, tripId: string, userId: string, refundAmount: number) => {
    try {
      await supabase.from('bookings').update({ status: 'CANCELLED' }).eq('id', bookingId);
      
      const { data: trip } = await supabase.from('trips').select('available_seats').eq('id', tripId).single();
      if (trip) {
         await supabase.from('trips').update({ 
             available_seats: trip.available_seats + 1,
             status: 'OPEN'
         }).eq('id', tripId);
      }
      
      const { data: booking } = await supabase.from('bookings').select('payment_method').eq('id', bookingId).single();
      if (booking && booking.payment_method !== 'DIRECT') {
          const { data: user } = await supabase.from('users').select('wallet_balance').eq('id', userId).single();
          if (user) {
              await supabase.from('users').update({ wallet_balance: user.wallet_balance + refundAmount }).eq('id', userId);
          }
      }
      
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e };
    }
  },

  getActiveBooking: async (uid: string) => {
    try {
      const { data, error } = await supabase.from('bookings')
         .select('*, trips(driver_name, driver_avatar, origin, destination, departure_time)')
         .eq('rider_id', uid)
         .eq('status', 'CONFIRMED')
         .order('created_at', { ascending: false })
         .limit(1);
         
      if (error || !data || data.length === 0) return null;
      
      const b = data[0];
      const tripInfo = b.trips;
      
      return {
          id: b.id,
          tripId: b.trip_id,
          userId: b.rider_id,
          driverId: b.driver_id,
          ownerName: tripInfo?.driver_name || 'Driver',
          ownerAvatar: tripInfo?.driver_avatar || '',
          ownerPhone: 'N/A',
          from: tripInfo?.origin?.address || 'Origin',
          to: tripInfo?.destination?.address || 'Destination',
          date: new Date(tripInfo?.departure_time || b.created_at).toLocaleDateString(),
          amount: b.amount,
          paymentMethod: b.payment_method,
          status: b.status,
          createdAt: b.created_at
      } as Booking;
    } catch (error) {
      console.error("Error fetching active booking:", error);
      return null;
    }
  },

  getUserBookings: async (uid: string) => {
    const { data } = await supabase.from('bookings')
       .select('*, trips(driver_name, driver_avatar, origin, destination, departure_time)')
       .eq('rider_id', uid);
       
    if (!data) return [];
    
    return data.map(b => {
      const tripInfo = b.trips;
      return {
          id: b.id,
          tripId: b.trip_id,
          userId: b.rider_id,
          driverId: b.driver_id,
          ownerName: tripInfo?.driver_name || 'Driver',
          ownerAvatar: tripInfo?.driver_avatar || '',
          ownerPhone: 'N/A',
          from: tripInfo?.origin?.address || 'Origin',
          to: tripInfo?.destination?.address || 'Destination',
          date: new Date(tripInfo?.departure_time || b.created_at).toLocaleDateString(),
          amount: b.amount,
          paymentMethod: b.payment_method,
          status: b.status,
          createdAt: b.created_at
      } as Booking;
    });
  }
};

export const driverService = {
  recalculateEarnings: async (uid: string) => {
    const { data } = await supabase.from('bookings').select('amount').eq('driver_id', uid).eq('status', 'CONFIRMED');
    let total = 0;
    data?.forEach(b => total += (b.amount || 0));
    await supabase.from('users').update({ earnings: total }).eq('id', uid);
    return total;
  },

  getEarningsHistory: async (uid: string) => {
    const { data } = await supabase.from('driver_transactions').select('*').eq('driver_id', uid).order('created_at', { ascending: false });
    return { data: data || [] };
  },

  redeemEarnings: async (uid: string, amount: number, bank: any) => {
    try {
      await supabase.from('driver_transactions').insert({
          driver_id: uid, amount, type: 'WITHDRAWAL', status: 'PROCESSING', created_at: Date.now()
      });
      await supabase.from('users').update({ earnings: 0 }).eq('id', uid);
      return { success: true };
    } catch (error: any) {
      return { success: false, error };
    }
  },

  saveBankDetails: async (uid: string, bank: any) => {
    try {
      await supabase.from('users').update({ bank_details: bank }).eq('id', uid);
      return { success: true };
    } catch (error: any) {
      return { success: false, error };
    }
  }
};

export const locationService = {
  updateUserLocation: async (uid: string, loc: LiveLocation) => {
    await supabase.from('live_locations').upsert({ id: uid, ...loc, updated_at: Date.now() });
  },
  listenToUserLocation: (uid: string, callback: (loc: LiveLocation | null) => void) => {
    supabase.from('live_locations').select('*').eq('id', uid).single().then(({ data }) => {
      callback(data ? (data as unknown as LiveLocation) : null);
    });

    const channel = supabase.channel(`public:live_locations:id=eq.${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_locations', filter: `id=eq.${uid}` }, payload => {
        callback(payload.new as unknown as LiveLocation);
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }
};

export const chatService = {
  ensureChatExists: async (id: string, participants: string[]) => {
    try {
      const { data } = await supabase.from('chats').select('id').eq('id', id).single();
      if (!data) {
         await supabase.from('chats').insert({ id, participants, last_message: "" });
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error };
    }
  },
  sendMessage: async (id: string, text: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { error: "Auth required" };
    
    await supabase.from('messages').insert({ chat_id: id, sender_id: session.user.id, text });
    await supabase.from('chats').update({ last_message: text, updated_at: new Date().toISOString() }).eq('id', id);
    return { success: true };
  },
  listenToMessages: (id: string, callback: (msgs: any[]) => void, errorCallback?: (error: any) => void) => {
    supabase.from('messages').select('*').eq('chat_id', id).order('timestamp', { ascending: true }).then(({ data }) => {
      if (data) callback(data);
    }).catch(errorCallback);

    const channel = supabase.channel(`public:messages:chat_id=eq.${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${id}` }, payload => {
         // Fetch all again to keep order, or just append. Fetching all is simpler.
         supabase.from('messages').select('*').eq('chat_id', id).order('timestamp', { ascending: true }).then(({ data }) => {
            if (data) callback(data);
         });
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }
};

export const storageService = {
  uploadKYC: async (file: File, path: string) => {
    const { data, error } = await supabase.storage.from('kyc-documents').upload(path, file);
    if (error) return { url: null, error };
    
    const { data: { publicUrl } } = supabase.storage.from('kyc-documents').getPublicUrl(path);
    return { url: publicUrl, error: null };
  }
};

export const kycService = {
  submitCustomerKYC: async (uid: string, data: any) => {
    await supabase.from('users').update({ kyc_data: data, is_verified: false }).eq('id', uid);
    return { error: null };
  },
  registerDriverBasicInfo: async (uid: string, data: any) => {
    await supabase.from('drivers').upsert({ id: uid, vehicle_details: data, verification_status: 'incomplete' });
    return { success: true };
  },
  submitDriverKYC: async (uid: string, data: any) => {
    await supabase.from('drivers').update({ license_number: data.license, verification_status: 'pending' }).eq('id', uid);
    await supabase.from('users').update({ is_driver: true }).eq('id', uid);
    return { error: null };
  }
};
