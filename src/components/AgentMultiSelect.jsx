import { useState, useEffect } from "react"
import { X, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useAuth } from '../useAuth.jsx'

export default function AgentMultiSelect({ value = [], onChange }) {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const { apiCall } = useAuth()

  useEffect(() => {
    fetchAgents()
  }, [])

  const fetchAgents = async () => {
    try {
      setLoading(true)
      const data = await apiCall('/agents?active=true')
      setAgents(data.agents || [])
    } catch (error) {
      console.error('Failed to fetch agents:', error)
      setAgents([])
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (agentId) => {
    const newValue = value.includes(agentId)
      ? value.filter(id => id !== agentId)
      : [...value, agentId]
    onChange(newValue)
  }

  const handleRemove = (agentId) => {
    onChange(value.filter(id => id !== agentId))
  }

  const filteredAgents = agents.filter(agent =>
    !searchTerm ||
    `${agent.first_name} ${agent.last_name} ${agent.email}`.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedAgents = agents.filter(agent => value.includes(agent.id))

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          placeholder="Search agents to notify..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        />

        {showDropdown && (
          <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
            {loading ? (
              <div className="p-3 text-sm text-muted-foreground">Loading agents...</div>
            ) : filteredAgents.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">No agents found</div>
            ) : (
              filteredAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="p-3 cursor-pointer hover:bg-accent border-b last:border-b-0"
                  onClick={() => handleSelect(agent.id)}
                >
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        {agent.first_name} {agent.last_name}
                        {value.includes(agent.id) && (
                          <Badge variant="secondary" className="text-xs">Selected</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
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
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {selectedAgents.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedAgents.map((agent) => (
            <Badge
              key={agent.id}
              variant="secondary"
              className="flex items-center gap-1"
            >
              {agent.first_name} {agent.last_name}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleRemove(agent.id)}
              />
            </Badge>
          ))}
        </div>
      )}

      {value.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {value.length} agent{value.length === 1 ? '' : 's'} selected
        </div>
      )}
    </div>
  )
}