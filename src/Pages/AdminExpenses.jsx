import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '../useAuth.jsx';
import { toast } from 'sonner';
import {
  Plus,
  Edit,
  Trash2,
  Calendar,
  Search,
  DollarSign,
  Receipt,
  Filter,
  Download,
  Loader2,
  AlertCircle
} from 'lucide-react';

const expenseCategories = [
  { value: 'fuel', label: 'Fuel' },
  { value: 'food', label: 'Food' },
  { value: 'parking', label: 'Parking' },
  { value: 'tolls', label: 'Tolls' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'lodging', label: 'Lodging' },
  { value: 'notice_fees', label: 'Notice Fees' },
  { value: 'other', label: 'Other' }
];

const paymentMethods = [
  { value: 'company_card', label: 'Company Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'personal_card', label: 'Personal Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' }
];

const expenseStatuses = [
  { value: 'logged', label: 'Logged' },
  { value: 'approved', label: 'Approved' },
  { value: 'reimbursed', label: 'Reimbursed' }
];

export default function AdminExpenses() {
  const { apiCall } = useAuth();
  
  // State management
  const [expenses, setExpenses] = useState([]);
  const [totals, setTotals] = useState({ net: 0, vat: 0, gross: 0 });
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    category: '',
    job_id: '',
    search: ''
  });
  
  // Form state
  const [expenseForm, setExpenseForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: '',
    description: '',
    amount_net: '',
    vat_rate: '0.20',
    job_id: '',
    paid_with: '',
    supplier: '',
    receipt_url: '',
    status: 'logged'
  });

  useEffect(() => {
    fetchExpenses();
  }, [filters]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = new URLSearchParams();
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);
      if (filters.category) params.append('category', filters.category);
      if (filters.job_id) params.append('job_id', filters.job_id);
      
      const queryString = params.toString();
      const url = queryString ? `/admin/expenses?${queryString}` : '/admin/expenses';
      
      const data = await apiCall(url);
      
      // Client-side search filter
      let filteredExpenses = data.expenses || [];
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredExpenses = filteredExpenses.filter(expense =>
          expense.description?.toLowerCase().includes(searchLower) ||
          expense.supplier?.toLowerCase().includes(searchLower) ||
          expense.category?.toLowerCase().includes(searchLower)
        );
      }
      
      setExpenses(filteredExpenses);
      setTotals(data.totals || { net: 0, vat: 0, gross: 0 });
    } catch (error) {
      console.error('Failed to fetch expenses:', error);
      toast.error('Failed to load expenses');
      setExpenses([]);
      setTotals({ net: 0, vat: 0, gross: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const expenseData = {
        ...expenseForm,
        amount_net: parseFloat(expenseForm.amount_net),
        vat_rate: parseFloat(expenseForm.vat_rate),
        job_id: expenseForm.job_id ? parseInt(expenseForm.job_id) : null
      };

      await apiCall('/admin/expenses', {
        method: 'POST',
        body: JSON.stringify(expenseData)
      });

      toast.success('Expense created successfully');
      setShowCreateDialog(false);
      resetForm();
      fetchExpenses();
    } catch (error) {
      console.error('Failed to create expense:', error);
      toast.error('Failed to create expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateExpense = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const expenseData = {
        ...expenseForm,
        amount_net: parseFloat(expenseForm.amount_net),
        vat_rate: parseFloat(expenseForm.vat_rate),
        job_id: expenseForm.job_id ? parseInt(expenseForm.job_id) : null
      };

      await apiCall(`/admin/expenses/${editingExpense.id}`, {
        method: 'PATCH',
        body: JSON.stringify(expenseData)
      });

      toast.success('Expense updated successfully');
      setShowEditDialog(false);
      setEditingExpense(null);
      resetForm();
      fetchExpenses();
    } catch (error) {
      console.error('Failed to update expense:', error);
      toast.error('Failed to update expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
      await apiCall(`/admin/expenses/${expenseId}`, {
        method: 'DELETE'
      });

      toast.success('Expense deleted successfully');
      fetchExpenses();
    } catch (error) {
      console.error('Failed to delete expense:', error);
      toast.error('Failed to delete expense');
    }
  };

  const startEdit = (expense) => {
    setExpenseForm({
      date: expense.date,
      category: expense.category,
      description: expense.description,
      amount_net: expense.amount_net.toString(),
      vat_rate: expense.vat_rate.toString(),
      job_id: expense.job_id?.toString() || '',
      paid_with: expense.paid_with,
      supplier: expense.supplier || '',
      receipt_url: expense.receipt_url || '',
      status: expense.status
    });
    setEditingExpense(expense);
    setShowEditDialog(true);
  };

  const resetForm = () => {
    setExpenseForm({
      date: new Date().toISOString().split('T')[0],
      category: '',
      description: '',
      amount_net: '',
      vat_rate: '0.20',
      job_id: '',
      paid_with: '',
      supplier: '',
      receipt_url: '',
      status: 'logged'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount || 0);
  };

  const getStatusBadge = (status) => {
    const variants = {
      logged: 'bg-yellow-900/50 text-yellow-400 border-yellow-500/50',
      approved: 'bg-blue-900/50 text-blue-400 border-blue-500/50',
      reimbursed: 'bg-green-900/50 text-green-400 border-green-500/50'
    };
    return variants[status] || 'bg-gray-700 text-gray-400';
  };

  const getCategoryBadge = (category) => {
    const variants = {
      fuel: 'bg-red-900/50 text-red-400 border-red-500/50',
      food: 'bg-orange-900/50 text-orange-400 border-orange-500/50',
      parking: 'bg-blue-900/50 text-blue-400 border-blue-500/50',
      tolls: 'bg-purple-900/50 text-purple-400 border-purple-500/50',
      equipment: 'bg-green-900/50 text-green-400 border-green-500/50',
      lodging: 'bg-indigo-900/50 text-indigo-400 border-indigo-500/50',
      notice_fees: 'bg-yellow-900/50 text-yellow-400 border-yellow-500/50',
      other: 'bg-gray-900/50 text-gray-400 border-gray-500/50'
    };
    return variants[category] || 'bg-gray-700 text-gray-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground">
            Manage job-related expenses and track spending
          </p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add New Expense</DialogTitle>
              <DialogDescription>
                Create a new expense record with VAT calculation
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateExpense}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={expenseForm.date}
                      onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={expenseForm.category} onValueChange={(value) => setExpenseForm({...expenseForm, category: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseCategories.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})}
                    placeholder="Expense description..."
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount_net">Amount (Net)</Label>
                    <Input
                      id="amount_net"
                      type="number"
                      step="0.01"
                      value={expenseForm.amount_net}
                      onChange={(e) => setExpenseForm({...expenseForm, amount_net: e.target.value})}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vat_rate">VAT Rate</Label>
                    <Select value={expenseForm.vat_rate} onValueChange={(value) => setExpenseForm({...expenseForm, vat_rate: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0.00">0% (No VAT)</SelectItem>
                        <SelectItem value="0.05">5%</SelectItem>
                        <SelectItem value="0.20">20% (Standard)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="job_id">Job ID (Optional)</Label>
                    <Input
                      id="job_id"
                      type="number"
                      value={expenseForm.job_id}
                      onChange={(e) => setExpenseForm({...expenseForm, job_id: e.target.value})}
                      placeholder="Link to specific job"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paid_with">Payment Method</Label>
                    <Select value={expenseForm.paid_with} onValueChange={(value) => setExpenseForm({...expenseForm, paid_with: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map(method => (
                          <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="supplier">Supplier (Optional)</Label>
                    <Input
                      id="supplier"
                      value={expenseForm.supplier}
                      onChange={(e) => setExpenseForm({...expenseForm, supplier: e.target.value})}
                      placeholder="Supplier name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={expenseForm.status} onValueChange={(value) => setExpenseForm({...expenseForm, status: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseStatuses.map(status => (
                          <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Expense'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Net</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(totals.net)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total VAT</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(totals.vat)}</p>
              </div>
              <Receipt className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Gross</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.gross)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>From Date</Label>
              <Input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters({...filters, from: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>To Date</Label>
              <Input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters({...filters, to: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={filters.category} onValueChange={(value) => setFilters({...filters, category: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                  {expenseCategories.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Job ID</Label>
              <Input
                type="number"
                value={filters.job_id}
                onChange={(e) => setFilters({...filters, job_id: e.target.value})}
                placeholder="Filter by job"
              />
            </div>
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                  placeholder="Search description..."
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Expenses ({expenses.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p>No expenses found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 text-sm font-medium">Date</th>
                    <th className="text-left p-2 text-sm font-medium">Category</th>
                    <th className="text-left p-2 text-sm font-medium">Description</th>
                    <th className="text-left p-2 text-sm font-medium">Net</th>
                    <th className="text-left p-2 text-sm font-medium">VAT</th>
                    <th className="text-left p-2 text-sm font-medium">Gross</th>
                    <th className="text-left p-2 text-sm font-medium">Status</th>
                    <th className="text-left p-2 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 text-sm">{expense.date}</td>
                      <td className="p-2">
                        <Badge className={getCategoryBadge(expense.category)} variant="outline">
                          {expenseCategories.find(c => c.value === expense.category)?.label || expense.category}
                        </Badge>
                      </td>
                      <td className="p-2 text-sm max-w-xs truncate">{expense.description}</td>
                      <td className="p-2 text-sm font-medium">{formatCurrency(expense.amount_net)}</td>
                      <td className="p-2 text-sm">{formatCurrency(expense.vat_amount)}</td>
                      <td className="p-2 text-sm font-bold">{formatCurrency(expense.amount_gross)}</td>
                      <td className="p-2">
                        <Badge className={getStatusBadge(expense.status)} variant="outline">
                          {expenseStatuses.find(s => s.value === expense.status)?.label || expense.status}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <Button
                            onClick={() => startEdit(expense)}
                            size="sm"
                            variant="outline"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            onClick={() => handleDeleteExpense(expense.id)}
                            size="sm"
                            variant="destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>
              Update expense details and VAT calculation
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateExpense}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-date">Date</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Category</Label>
                  <Select value={expenseForm.category} onValueChange={(value) => setExpenseForm({...expenseForm, category: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})}
                  placeholder="Expense description..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-amount_net">Amount (Net)</Label>
                  <Input
                    id="edit-amount_net"
                    type="number"
                    step="0.01"
                    value={expenseForm.amount_net}
                    onChange={(e) => setExpenseForm({...expenseForm, amount_net: e.target.value})}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-vat_rate">VAT Rate</Label>
                  <Select value={expenseForm.vat_rate} onValueChange={(value) => setExpenseForm({...expenseForm, vat_rate: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.00">0% (No VAT)</SelectItem>
                      <SelectItem value="0.05">5%</SelectItem>
                      <SelectItem value="0.20">20% (Standard)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-job_id">Job ID (Optional)</Label>
                  <Input
                    id="edit-job_id"
                    type="number"
                    value={expenseForm.job_id}
                    onChange={(e) => setExpenseForm({...expenseForm, job_id: e.target.value})}
                    placeholder="Link to specific job"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-paid_with">Payment Method</Label>
                  <Select value={expenseForm.paid_with} onValueChange={(value) => setExpenseForm({...expenseForm, paid_with: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map(method => (
                        <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-supplier">Supplier (Optional)</Label>
                  <Input
                    id="edit-supplier"
                    value={expenseForm.supplier}
                    onChange={(e) => setExpenseForm({...expenseForm, supplier: e.target.value})}
                    placeholder="Supplier name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select value={expenseForm.status} onValueChange={(value) => setExpenseForm({...expenseForm, status: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseStatuses.map(status => (
                        <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Expense'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}