import { Calendar, AlertCircle, FileText } from 'lucide-react';

export default function CRMDashboard({ dashboard, todayTasks, onCompleteTask, onSnoozeTask }) {
  return (
    <>
      {/* Dashboard Stats */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          <div className="dashboard-card !p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-v3-text-muted text-xs mb-1">Follow-ups Today</p>
                <p className="text-xl font-bold text-v3-brand">{dashboard.followups_today}</p>
              </div>
              <Calendar className="h-6 w-6 text-v3-brand opacity-50" />
            </div>
          </div>

          <div className="dashboard-card !p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-v3-text-muted text-xs mb-1">Overdue Follow-ups</p>
                <p className="text-xl font-bold text-red-600">{dashboard.overdue_followups}</p>
              </div>
              <AlertCircle className="h-6 w-6 text-red-600 opacity-50" />
            </div>
          </div>

          <div className="dashboard-card !p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-v3-text-muted text-xs mb-1">Quotes Pending</p>
                <p className="text-xl font-bold text-yellow-600">{dashboard.quotes_pending}</p>
              </div>
              <FileText className="h-6 w-6 text-yellow-600 opacity-50" />
            </div>
          </div>
        </div>
      )}

      {/* My Tasks Today Widget */}
      {todayTasks.length > 0 && (
        <div className="dashboard-card mb-6">
          <h3 className="text-lg font-semibold text-v3-text-lightest mb-4">⏰ My Tasks Today ({todayTasks.length})</h3>
          <div className="space-y-2">
            {todayTasks.slice(0, 5).map((task) => (
              <div key={task.id} className="flex items-center justify-between p-3 bg-v3-bg-darker rounded">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs rounded ${task.is_overdue ? 'bg-red-600/20 text-red-400' : 'bg-yellow-600/20 text-yellow-400'}`}>
                      {task.task_type}
                    </span>
                    <span className="text-v3-text-lightest">{task.title}</span>
                  </div>
                  <p className="text-sm text-v3-text-muted mt-1">{task.contact_name} • Due: {new Date(task.due_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onCompleteTask(task.id)}
                    className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    ✓ Complete
                  </button>
                  <button
                    onClick={() => onSnoozeTask(task.id, '1hour')}
                    className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    Snooze 1h
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
