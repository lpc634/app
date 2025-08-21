import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import CreateJob from '../Pages/CreateJob'

// Mock fetch
global.fetch = vi.fn()

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock the context
const MockProvider = ({ children, userRole = 'admin' }) => {
  const mockUser = {
    id: 1,
    email: 'admin@test.com',
    role: userRole,
    first_name: 'Admin',
    last_name: 'User'
  }

  return (
    <BrowserRouter>
      {/* Mock the context provider */}
      <div data-testid="mock-provider">
        {/* Inject mock user via React context or props if needed */}
        {typeof children === 'function' ? children({ user: mockUser }) : children}
      </div>
    </BrowserRouter>
  )
}

describe('CreateJob Billing UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key) => {
          if (key === 'token') return 'mock-token'
          if (key === 'user') return JSON.stringify({
            id: 1,
            email: 'admin@test.com',
            role: 'admin',
            first_name: 'Admin',
            last_name: 'User'
          })
          return null
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    })
  })

  it('renders billing configuration section for admin users', async () => {
    render(
      <MockProvider userRole="admin">
        <CreateJob />
      </MockProvider>
    )

    // Wait for component to load and check for billing elements
    await waitFor(() => {
      // Look for billing-related labels/text
      expect(screen.getByText(/Billing Configuration/i)).toBeInTheDocument()
    })
  })

  it('shows hourly rate input field', async () => {
    render(
      <MockProvider userRole="admin">
        <CreateJob />
      </MockProvider>
    )

    await waitFor(() => {
      const hourlyRateInput = screen.getByPlaceholderText('45.00')
      expect(hourlyRateInput).toBeInTheDocument()
      expect(hourlyRateInput).toHaveAttribute('type', 'number')
      expect(hourlyRateInput).toHaveAttribute('step', '0.01')
    })
  })

  it('shows first hour rate input field', async () => {
    render(
      <MockProvider userRole="admin">
        <CreateJob />
      </MockProvider>
    )

    await waitFor(() => {
      const firstHourRateInput = screen.getByPlaceholderText('120.00')
      expect(firstHourRateInput).toBeInTheDocument()
      expect(firstHourRateInput).toHaveAttribute('type', 'number')
      expect(firstHourRateInput).toHaveAttribute('step', '0.01')
    })
  })

  it('shows notice fee input field', async () => {
    render(
      <MockProvider userRole="admin">
        <CreateJob />
      </MockProvider>
    )

    await waitFor(() => {
      const noticeFeeInput = screen.getByPlaceholderText('75.00')
      expect(noticeFeeInput).toBeInTheDocument()
      expect(noticeFeeInput).toHaveAttribute('type', 'number')
      expect(noticeFeeInput).toHaveAttribute('step', '0.01')
    })
  })

  it('shows VAT rate dropdown with correct options', async () => {
    render(
      <MockProvider userRole="admin">
        <CreateJob />
      </MockProvider>
    )

    await waitFor(() => {
      const vatSelect = screen.getByDisplayValue('20%') || screen.getByText('20%').closest('select')
      expect(vatSelect).toBeInTheDocument()
      
      // Check for VAT rate options
      expect(screen.getByText('0% (No VAT)')).toBeInTheDocument()
      expect(screen.getByText('5% (Reduced)')).toBeInTheDocument()
      expect(screen.getByText('20% (Standard)')).toBeInTheDocument()
    })
  })

  it('shows agent count input field', async () => {
    render(
      <MockProvider userRole="admin">
        <CreateJob />
      </MockProvider>
    )

    await waitFor(() => {
      const agentCountInput = screen.getByPlaceholderText('3')
      expect(agentCountInput).toBeInTheDocument()
      expect(agentCountInput).toHaveAttribute('type', 'number')
    })
  })

  it('shows billable hours override input field', async () => {
    render(
      <MockProvider userRole="admin">
        <CreateJob />
      </MockProvider>
    )

    await waitFor(() => {
      const hoursOverrideInput = screen.getByPlaceholderText('30.5')
      expect(hoursOverrideInput).toBeInTheDocument()
      expect(hoursOverrideInput).toHaveAttribute('type', 'number')
      expect(hoursOverrideInput).toHaveAttribute('step', '0.25')
    })
  })

  it('allows input of billing values', async () => {
    render(
      <MockProvider userRole="admin">
        <CreateJob />
      </MockProvider>
    )

    await waitFor(() => {
      const hourlyRateInput = screen.getByPlaceholderText('45.00')
      
      // Test input functionality
      fireEvent.change(hourlyRateInput, { target: { value: '50.00' } })
      expect(hourlyRateInput.value).toBe('50.00')
    })
  })

  it('does not show billing section for non-admin users', async () => {
    render(
      <MockProvider userRole="agent">
        <CreateJob />
      </MockProvider>
    )

    await waitFor(() => {
      // Billing section should not be visible for agents
      expect(screen.queryByText(/Billing Configuration/i)).not.toBeInTheDocument()
    })
  })

  it('includes billing data in job submission for admin users', async () => {
    // Mock successful API response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Job created successfully', job: { id: 1 } })
    })

    render(
      <MockProvider userRole="admin">
        <CreateJob />
      </MockProvider>
    )

    await waitFor(() => {
      // Fill in required job fields
      const titleInput = screen.getByPlaceholderText(/job title/i)
      const addressInput = screen.getByPlaceholderText(/job address/i)
      
      fireEvent.change(titleInput, { target: { value: 'Test Security Job' } })
      fireEvent.change(addressInput, { target: { value: '123 Test Street' } })
      
      // Fill in billing fields
      const hourlyRateInput = screen.getByPlaceholderText('45.00')
      fireEvent.change(hourlyRateInput, { target: { value: '50.00' } })
      
      // Submit the form
      const submitButton = screen.getByText(/Create Job/i)
      fireEvent.click(submitButton)
    })

    // Check that fetch was called with billing data
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled()
      const [url, options] = fetch.mock.calls[0]
      expect(url).toContain('/jobs')
      
      const requestBody = JSON.parse(options.body)
      expect(requestBody.billing).toBeDefined()
      expect(requestBody.billing.hourly_rate_net).toBe(50.00)
    })
  })
})