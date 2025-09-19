import { useState, useEffect, useMemo } from "react"
import { X, User, ChevronDown, ChevronRight, Users, Star, CheckSquare, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useAuth } from '../useAuth.jsx'

export default function AgentMultiSelect({ arrivalISO = null, value = [], onChange }) {
  const [allAgents, setAllAgents] = useState([])
  const [availableAgents, setAvailableAgents] = useState([])
  const [reliableAgents, setReliableAgents] = useState([])
  const [loading, setLoading] = useState({ all: false, available: false, reliable: false })
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedSections, setExpandedSections] = useState({
    available: true,
    reliable: true,
    all: true
  })
  const { apiCall } = useAuth()

  // Fetch all agents on mount
  useEffect(() => {
    fetchAllAgents()
    fetchReliableAgents()
  }, [])

  // Fetch available agents when arrival date changes
  useEffect(() => {
    if (arrivalISO) {
      fetchAvailableAgents()
    } else {
      setAvailableAgents([])
    }
  }, [arrivalISO])

  const fetchAllAgents = async () => {
    try {
      setLoading(prev => ({ ...prev, all: true }))
      const data = await apiCall('/agents?active=true')
      setAllAgents(data.agents || [])
    } catch (error) {
      console.error('Failed to fetch all agents:', error)
      setAllAgents([])
    } finally {
      setLoading(prev => ({ ...prev, all: false }))
    }
  }

  const fetchAvailableAgents = async () => {
    if (!arrivalISO) return

    try {
      setLoading(prev => ({ ...prev, available: true }))
      const date = arrivalISO.split('T')[0] // Extract YYYY-MM-DD from datetime
      const data = await apiCall(`/agents/available?start=${date}&end=${date}`)
      setAvailableAgents(data.agents || [])
    } catch (error) {
      console.error('Failed to fetch available agents:', error)
      setAvailableAgents([])
    } finally {
      setLoading(prev => ({ ...prev, available: false }))
    }
  }

  const fetchReliableAgents = async () => {
    try {
      setLoading(prev => ({ ...prev, reliable: true }))
      const data = await apiCall('/agents/reliability?limit=20')
      setReliableAgents(data.agents || [])
    } catch (error) {
      console.error('Failed to fetch reliable agents:', error)
      setReliableAgents([])
    } finally {
      setLoading(prev => ({ ...prev, reliable: false }))
    }
  }

  const handleToggle = (agentId) => {
    const newValue = value.includes(agentId)
      ? value.filter(id => id !== agentId)
      : [...value, agentId]
    onChange(newValue)
  }

  const handleSelectAll = (agents) => {
    const agentIds = agents.map(a => a.id)
    const newValue = [...new Set([...value, ...agentIds])]
    onChange(newValue)
  }

  const handleClearGroup = (agents) => {
    const agentIds = agents.map(a => a.id)
    const newValue = value.filter(id => !agentIds.includes(id))
    onChange(newValue)
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // Filter agents based on search term
  const filteredAgents = useMemo(() => {
    const filterAgents = (agentList) => {
      if (!searchTerm) return agentList
      return agentList.filter(agent =>
        `${agent.display_name} ${agent.email}`.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    return {
      available: filterAgents(availableAgents),
      reliable: filterAgents(reliableAgents),
      all: filterAgents(allAgents)
    }
  }, [availableAgents, reliableAgents, allAgents, searchTerm])

  // Get selected agents for display
  const selectedAgents = useMemo(() => {
    const allAgentsList = [...allAgents, ...availableAgents, ...reliableAgents]
    const uniqueAgents = allAgentsList.reduce((acc, agent) => {
      if (!acc.find(a => a.id === agent.id)) {
        acc.push(agent)
      }
      return acc
    }, [])
    return uniqueAgents.filter(agent => value.includes(agent.id))
  }, [allAgents, availableAgents, reliableAgents, value])

  const renderAgentRow = (agent, showStats = false) => (
    <div
      key={agent.id}
      className="flex items-center gap-3 p-2 hover:bg-accent/50 rounded cursor-pointer"
      onClick={() => handleToggle(agent.id)}
    >
      {value.includes(agent.id) ? (
        <CheckSquare className="h-4 w-4 text-primary" />
      ) : (
        <Square className="h-4 w-4 text-muted-foreground" />
      )}

      <User className="h-4 w-4 text-muted-foreground" />

      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">
          {agent.display_name}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {agent.email}
        </div>
        {agent.skills && agent.skills.length > 0 && (
          <div className="flex gap-1 mt-1">
            {agent.skills.slice(0, 2).map((skill, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {skill}
              </Badge>
            ))}
            {agent.skills.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{agent.skills.length - 2}
              </Badge>
            )}
          </div>
        )}
      </div>

      {showStats && agent.accept_rate !== undefined && (
        <div className="text-xs text-muted-foreground">
          {Math.round(agent.accept_rate * 100)}% ({agent.accepted}/{agent.offered})
        </div>
      )}
    </div>
  )

  const renderSection = (title, agents, key, icon, disabled = false, disabledMessage = null) => {
    const isExpanded = expandedSections[key]
    const count = agents.length
    const isLoading = loading[key]

    return (
      <div className="border rounded-lg">
        <div
          className={`p-3 cursor-pointer flex items-center justify-between ${
            disabled ? 'opacity-50' : 'hover:bg-accent/50'
          }`}
          onClick={() => !disabled && toggleSection(key)}
        >
          <div className="flex items-center gap-2">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {icon}
            <span className="font-medium text-sm">
              {title} {!disabled && <Badge variant="outline" className="ml-2">{count}</Badge>}
            </span>
          </div>

          {!disabled && isExpanded && count > 0 && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  handleSelectAll(agents)
                }}
              >
                Select all
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClearGroup(agents)
                }}
              >
                Clear
              </Button>
            </div>
          )}
        </div>

        {isExpanded && (
          <div className="border-t bg-muted/20">
            {disabled && disabledMessage ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                {disabledMessage}
              </div>
            ) : isLoading ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Loading agents...
              </div>
            ) : agents.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                No agents found
              </div>
            ) : (
              <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                {agents.map((agent) => renderAgentRow(agent, key === 'reliable'))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search input */}
      <Input
        placeholder="Search across all agent groups..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full"
      />

      {/* Available on date section */}
      {renderSection(
        "Available on date",
        filteredAgents.available,
        "available",
        <Users className="h-4 w-4 text-green-600" />,
        !arrivalISO,
        "Pick an arrival date to see availability"
      )}

      {/* Most reliable section */}
      {renderSection(
        "Most reliable (90 days)",
        filteredAgents.reliable,
        "reliable",
        <Star className="h-4 w-4 text-yellow-600" />
      )}

      {/* All agents section */}
      {renderSection(
        "All agents",
        filteredAgents.all,
        "all",
        <User className="h-4 w-4 text-blue-600" />
      )}

      {/* Selected agents summary */}
      {selectedAgents.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            Selected agents ({selectedAgents.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedAgents.map((agent) => (
              <Badge
                key={agent.id}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {agent.display_name}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => handleToggle(agent.id)}
                />
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}