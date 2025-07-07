import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../useAuth';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Calendar, Save, Repeat, Zap, AlertCircle, ChevronRight } from 'lucide-react';

const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const AvailabilityPage = () => {
  const [weeklySchedule, setWeeklySchedule] = useState({});
  const [weekView, setWeekView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const { user, apiCall } = useAuth();

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [weeklyRes, weekViewRes] = await Promise.all([
        apiCall(`/availability/weekly/${user.id}`),
        apiCall(`/availability/week-view/${user.id}`)
      ]);
      setWeeklySchedule(weeklyRes || {});
      setWeekView(weekViewRes || null);
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
      toast.success("Default weekly schedule saved!");
      fetchData();
    } catch (error) {
      toast.error("Failed to save schedule.", { description: error.message });
    }
  };

  const handleSetupNextWeek = async () => {
    try {
      setSetupLoading(true);
      const response = await apiCall(`/availability/setup-next-week/${user.id}`, {
        method: 'POST',
      });
      toast.success(response.message || "Next week availability set!");
      fetchData();
    } catch (error) {
      toast.error("Failed to setup next week.", { description: error.message });
    } finally {
      setSetupLoading(false);
    }
  };

  const handleDayToggle = async (date, currentStatus) => {
    try {
      await apiCall(`/availability/daily/${user.id}`, {
        method: 'POST',
        body: JSON.stringify({ date, is_available: !currentStatus }),
      });
      toast.success(`Availability updated for ${new Date(date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`);
      fetchData();
    } catch (error) {
      toast.error("Failed to update availability.", { description: error.message });
    }
  };

  const formatDateRange = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };

  const isToday = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isPastDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  if (loading) {
    return <div className="p-6"><Loader2 className="animate-spin" /></div>;
  }

  const hasWeeklySchedule = Object.values(weeklySchedule).some(val => val === true);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-v3-text-lightest">My Availability</h1>
      
      {/* Alert if it's Sunday */}
      {new Date().getDay() === 0 && (
        <Card className="dashboard-card border-v3-orange bg-v3-orange/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-v3-orange">
              <AlertCircle size={20} /> Sunday Reminder
            </CardTitle>
            <CardDescription className="text-v3-text-light">
              Please confirm your availability for next week. Use the "Apply Default to Next Week" button or manually set each day.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
      
      {/* Default Weekly Schedule */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Repeat size={20} /> Default Weekly Schedule
          </CardTitle>
          <CardDescription>
            Set your typical weekly pattern. This will be used as the default when setting up each week.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 mb-4">
            {daysOfWeek.map(day => (
              <div key={day} className="flex items-center space-x-2 p-3 rounded-lg bg-v3-bg-dark">
                <Checkbox
                  id={day}
                  checked={!!weeklySchedule[day]}
                  onCheckedChange={() => handleWeeklyChange(day)}
                />
                <Label htmlFor={day} className="capitalize text-v3-text-light text-sm font-medium">
                  {day.slice(0, 3)}
                </Label>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveWeeklySchedule} className="button-refresh">
              <Save size={16} className="mr-2" /> Save Default Pattern
            </Button>
            {hasWeeklySchedule && (
              <Button 
                onClick={handleSetupNextWeek} 
                className="button-refresh bg-green-600 hover:bg-green-700"
                disabled={setupLoading}
              >
                {setupLoading ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" /> 
                    Applying...
                  </>
                ) : (
                  <>
                    <Zap size={16} className="mr-2" /> 
                    Apply Default to Next Week
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Current Week */}
      {weekView && weekView.current_week && (
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar size={20} /> This Week
            </CardTitle>
            <CardDescription>
              {formatDateRange(weekView.current_week.start, weekView.current_week.end)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {weekView.current_week.days.map(day => {
              const isPast = isPastDate(day.date);
              const isCurrentDay = isToday(day.date);
              
              return (
                <div 
                  key={day.date} 
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    isCurrentDay ? 'bg-v3-orange/10 border border-v3-orange' : 
                    isPast ? 'bg-v3-bg-dark/50 opacity-60' : 
                    'bg-v3-bg-dark'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-v3-text-lightest">
                      {new Date(day.date).toLocaleDateString('en-GB', { 
                        weekday: 'long', 
                        day: 'numeric', 
                        month: 'short' 
                      })}
                      {isCurrentDay && <span className="text-v3-orange text-xs ml-2">(Today)</span>}
                    </p>
                    {day.source === 'override' && (
                      <p className="text-xs text-v3-orange">Manually set</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${
                      day.is_available ? 'text-green-400' : 'text-v3-text-muted'
                    }`}>
                      {day.is_available ? 'Available' : 'Unavailable'}
                    </span>
                    <Switch 
                      checked={day.is_available} 
                      onCheckedChange={() => handleDayToggle(day.date, day.is_available)}
                      disabled={isPast}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Next Week */}
      {weekView && weekView.next_week && (
        <Card className="dashboard-card border-blue-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-400">
              <ChevronRight size={20} /> Next Week
            </CardTitle>
            <CardDescription>
              {formatDateRange(weekView.next_week.start, weekView.next_week.end)} - Set your availability now
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {weekView.next_week.days.map(day => (
              <div 
                key={day.date} 
                className="flex items-center justify-between p-3 rounded-lg bg-v3-bg-dark"
              >
                <div>
                  <p className="font-semibold text-v3-text-lightest">
                    {new Date(day.date).toLocaleDateString('en-GB', { 
                      weekday: 'long', 
                      day: 'numeric', 
                      month: 'short' 
                    })}
                  </p>
                  {day.source === 'override' && (
                    <p className="text-xs text-v3-orange">Manually set</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${
                    day.is_available ? 'text-green-400' : 'text-v3-text-muted'
                  }`}>
                    {day.is_available ? 'Available' : 'Unavailable'}
                  </span>
                  <Switch 
                    checked={day.is_available} 
                    onCheckedChange={() => handleDayToggle(day.date, day.is_available)}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AvailabilityPage;