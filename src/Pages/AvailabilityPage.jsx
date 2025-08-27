import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../useAuth';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Calendar, Save, Repeat, Power, PowerOff } from 'lucide-react';

const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const AvailabilityPage = () => {
  const [weeklySchedule, setWeeklySchedule] = useState({});
  const [dailyOverrides, setDailyOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingToday, setTogglingToday] = useState(false);
  const { user, apiCall } = useAuth();

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [weeklyRes, dailyRes] = await Promise.all([
        apiCall(`/availability/weekly/${user.id}`),
        apiCall(`/availability/daily/${user.id}`)
      ]);
      setWeeklySchedule(weeklyRes || {});
      setDailyOverrides(dailyRes || []);
    } catch (error) {
      toast.error("Failed to load availability data.", { description: error.message });
    } finally {
      setLoading(false);
    }
  }, [apiCall, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleWeeklyChange = (day) => {
    setWeeklySchedule(prev => ({ ...prev, [day]: !prev[day] }));
  };

  const handleSaveWeeklySchedule = async () => {
    try {
      await apiCall(`/availability/weekly/${user.id}`, {
        method: 'POST',
        body: JSON.stringify(weeklySchedule),
      });
      toast.success("Recurring schedule saved!");
      fetchData();
    } catch (error) {
      toast.error("Failed to save schedule.", { description: error.message });
    }
  };

  const handleDailyOverrideToggle = async (date, currentStatus) => {
    const nextStatus = !currentStatus;
    setTogglingToday(true);
    const previousOverrides = dailyOverrides;
    // Optimistic update so the button works on first tap
    setDailyOverrides(prev => {
      const idx = prev.findIndex(d => d.date === date);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], is_available: nextStatus };
        return copy;
      }
      return [...prev, { date, is_available: nextStatus }];
    });
    try {
      await apiCall(`/availability/daily/${user.id}`, {
        method: 'POST',
        body: JSON.stringify({ date, is_available: nextStatus }),
      });
      toast.success(`Availability for ${date} updated.`);
      fetchData();
    } catch (error) {
      // Revert on failure
      setDailyOverrides(previousOverrides);
      toast.error("Failed to update availability.", { description: error.message });
    } finally {
      setTogglingToday(false);
    }
  };

  const getLocalDateString = (d = new Date()) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const da = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${da}`;
  };

  const getTodaysStatus = () => {
      const todayString = getLocalDateString();
      const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const dailyOverride = dailyOverrides.find(d => d.date === todayString);
      if (dailyOverride) {
        return dailyOverride.is_available;
      }
      return weeklySchedule[todayName] || false;
  };

  const isAvailableToday = getTodaysStatus();

  // --- NEW & MODIFIED: Custom CSS for glow effects and checkboxes ---
  const customStyles = `
    .text-glow-green { text-shadow: 0 0 8px #39FF14; }
    .text-glow-red { text-shadow: 0 0 8px #ef4444; }

    /* Custom Neon Checkbox Styling */
    .neon-checkbox {
      width: 24px !important;
      height: 24px !important;
      border: 2px solid white !important;
      background-color: transparent !important;
      border-radius: 4px !important;
      transition: all 0.2s ease-in-out;
    }
    .neon-checkbox[data-state="checked"] {
        border-color: #39FF14 !important;
        background-color: rgba(57, 255, 20, 0.1) !important;
        box-shadow: 0 0 7px #39FF14;
    }
    .neon-checkbox[data-state="checked"] .lucide-check {
        color: #39FF14 !important;
    }
  `;

  if (loading) {
    return <div className="p-6 flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-v3-orange" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-v3-bg-darkest min-h-screen-ios text-v3-text-light">
        <style>{customStyles}</style>

        <h1 className="text-3xl font-bold tracking-tight text-v3-text-lightest">My Availability</h1>
        <p className="text-v3-text-muted">Set your recurring weekly schedule and make one-off changes for specific days.</p>

        <Card className="dashboard-card">
            <CardHeader>
                <CardTitle>Today's Status Override</CardTitle>
                <CardDescription>Use this toggle for one-off changes to your availability for today.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
                <p className={`font-semibold text-lg ${isAvailableToday ? 'text-green-400 text-glow-green' : 'text-red-400 text-glow-red'}`}>
                    {isAvailableToday ? 'Available for work today' : 'Unavailable for work today'}
                </p>
                <Button 
                    variant="outline" 
                    onClick={() => handleDailyOverrideToggle(getLocalDateString(), isAvailableToday)}
                    className="w-48"
                    disabled={togglingToday}
                >
                    {togglingToday ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isAvailableToday ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />)}
                    {isAvailableToday ? 'Set to Unavailable' : 'Set to Available'}
                </Button>
            </CardContent>
        </Card>

        <Card className="dashboard-card">
            <CardHeader>
                <CardTitle>Set Recurring Weekly Schedule</CardTitle>
                <CardDescription>Toggle the days you are generally available to work each week.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {daysOfWeek.map((day) => (
                        <div key={day} className="flex items-center justify-between p-4 rounded-lg bg-v3-bg-dark">
                            <Label htmlFor={day} className="text-lg text-v3-text-lightest cursor-pointer capitalize">
                                {day}
                            </Label>
                            {/* --- MODIFIED: Added className to the Checkbox --- */}
                            <Checkbox
                                id={day}
                                checked={!!weeklySchedule[day]}
                                onCheckedChange={() => handleWeeklyChange(day)}
                                className="neon-checkbox"
                            />
                        </div>
                    ))}
                </div>
                <div className="mt-6 flex justify-end">
                    <Button className="button-refresh w-48" onClick={handleSaveWeeklySchedule}>
                        <Save className="mr-2 h-4 w-4" />
                        Save Schedule
                    </Button>
                </div>
            </CardContent>
        </Card>
    </div>
  );
};

export default AvailabilityPage;