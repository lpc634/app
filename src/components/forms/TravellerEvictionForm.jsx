import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, CheckCircle, Upload } from 'lucide-react';

const TravellerEvictionForm = ({ jobData, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    jobId: jobData?.id || '',
    jobTitle: jobData?.title || jobData?.address || '',
    agentName: jobData?.agentName || '',

    // Location Information
    propertyAddress: jobData?.address || '',
    accessPoint: '',

    // Eviction Details
    evictionDate: new Date().toISOString().split('T')[0],
    evictionTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
    numberOfVehicles: '',
    numberOfOccupants: '',

    // Vehicles Information
    vehicleDetails: '',

    // Occupant Information
    occupantDetails: '',
    spokespersonName: '',
    spokespersonContact: '',

    // Site Conditions
    wastePresent: false,
    utilitiesConnected: false,
    damageToPropery: false,
    conditionNotes: '',

    // Action Taken
    noticeServed: false,
    noticeType: '',
    departureTime: '',
    destinationKnown: false,
    destinationDetails: '',

    // Police Involvement
    policePresent: false,
    policeForce: '',
    officerName: '',
    officerNumber: '',
    incidentNumber: '',

    // Additional Notes
    additionalNotes: '',

    // Photos/Evidence
    photos: [],
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setFormData(prev => ({
      ...prev,
      photos: [...prev.photos, ...files]
    }));
  };

  const removePhoto = (index) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.propertyAddress) newErrors.propertyAddress = 'Property address is required';
    if (!formData.evictionDate) newErrors.evictionDate = 'Eviction date is required';
    if (!formData.evictionTime) newErrors.evictionTime = 'Eviction time is required';
    if (!formData.numberOfVehicles || formData.numberOfVehicles < 0) {
      newErrors.numberOfVehicles = 'Valid number of vehicles is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Job Information */}
      <Card>
        <CardHeader>
          <CardTitle>Job Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="jobId">Job ID</Label>
              <Input
                id="jobId"
                name="jobId"
                value={formData.jobId}
                disabled
                className="bg-v3-bg-dark"
              />
            </div>
            <div>
              <Label htmlFor="agentName">Agent Name</Label>
              <Input
                id="agentName"
                name="agentName"
                value={formData.agentName}
                disabled
                className="bg-v3-bg-dark"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location Information */}
      <Card>
        <CardHeader>
          <CardTitle>Location Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="propertyAddress">Property Address *</Label>
            <Input
              id="propertyAddress"
              name="propertyAddress"
              value={formData.propertyAddress}
              onChange={handleInputChange}
              className={errors.propertyAddress ? 'border-red-500' : ''}
              placeholder="Enter full property address"
            />
            {errors.propertyAddress && (
              <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                <AlertCircle size={14} /> {errors.propertyAddress}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="accessPoint">Access Point/Entry Method</Label>
            <Input
              id="accessPoint"
              name="accessPoint"
              value={formData.accessPoint}
              onChange={handleInputChange}
              placeholder="e.g., Main gate, side entrance, etc."
            />
          </div>
        </CardContent>
      </Card>

      {/* Eviction Details */}
      <Card>
        <CardHeader>
          <CardTitle>Eviction Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="evictionDate">Eviction Date *</Label>
              <Input
                type="date"
                id="evictionDate"
                name="evictionDate"
                value={formData.evictionDate}
                onChange={handleInputChange}
                className={errors.evictionDate ? 'border-red-500' : ''}
              />
              {errors.evictionDate && (
                <p className="text-red-500 text-sm mt-1">{errors.evictionDate}</p>
              )}
            </div>

            <div>
              <Label htmlFor="evictionTime">Eviction Time *</Label>
              <Input
                type="time"
                id="evictionTime"
                name="evictionTime"
                value={formData.evictionTime}
                onChange={handleInputChange}
                className={errors.evictionTime ? 'border-red-500' : ''}
              />
              {errors.evictionTime && (
                <p className="text-red-500 text-sm mt-1">{errors.evictionTime}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="numberOfVehicles">Number of Vehicles *</Label>
              <Input
                type="number"
                id="numberOfVehicles"
                name="numberOfVehicles"
                value={formData.numberOfVehicles}
                onChange={handleInputChange}
                className={errors.numberOfVehicles ? 'border-red-500' : ''}
                placeholder="0"
                min="0"
              />
              {errors.numberOfVehicles && (
                <p className="text-red-500 text-sm mt-1">{errors.numberOfVehicles}</p>
              )}
            </div>

            <div>
              <Label htmlFor="numberOfOccupants">Number of Occupants</Label>
              <Input
                type="number"
                id="numberOfOccupants"
                name="numberOfOccupants"
                value={formData.numberOfOccupants}
                onChange={handleInputChange}
                placeholder="0"
                min="0"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicles & Occupants */}
      <Card>
        <CardHeader>
          <CardTitle>Vehicles & Occupants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="vehicleDetails">Vehicle Details</Label>
            <Textarea
              id="vehicleDetails"
              name="vehicleDetails"
              value={formData.vehicleDetails}
              onChange={handleInputChange}
              placeholder="List vehicle registration numbers, makes, models, colors, etc."
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="occupantDetails">Occupant Details</Label>
            <Textarea
              id="occupantDetails"
              name="occupantDetails"
              value={formData.occupantDetails}
              onChange={handleInputChange}
              placeholder="General description of occupants (age ranges, number of families, etc.)"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="spokespersonName">Spokesperson Name</Label>
              <Input
                id="spokespersonName"
                name="spokespersonName"
                value={formData.spokespersonName}
                onChange={handleInputChange}
                placeholder="If identified"
              />
            </div>

            <div>
              <Label htmlFor="spokespersonContact">Spokesperson Contact</Label>
              <Input
                id="spokespersonContact"
                name="spokespersonContact"
                value={formData.spokespersonContact}
                onChange={handleInputChange}
                placeholder="Phone number or other contact"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Site Conditions */}
      <Card>
        <CardHeader>
          <CardTitle>Site Conditions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="wastePresent"
                name="wastePresent"
                checked={formData.wastePresent}
                onChange={handleInputChange}
                className="w-4 h-4"
              />
              <Label htmlFor="wastePresent" className="cursor-pointer">
                Waste/Rubbish Present
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="utilitiesConnected"
                name="utilitiesConnected"
                checked={formData.utilitiesConnected}
                onChange={handleInputChange}
                className="w-4 h-4"
              />
              <Label htmlFor="utilitiesConnected" className="cursor-pointer">
                Utilities Connected (Water/Electric)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="damageToPropery"
                name="damageToPropery"
                checked={formData.damageToPropery}
                onChange={handleInputChange}
                className="w-4 h-4"
              />
              <Label htmlFor="damageToPropery" className="cursor-pointer">
                Damage to Property
              </Label>
            </div>
          </div>

          <div>
            <Label htmlFor="conditionNotes">Condition Notes</Label>
            <Textarea
              id="conditionNotes"
              name="conditionNotes"
              value={formData.conditionNotes}
              onChange={handleInputChange}
              placeholder="Describe the overall condition of the site, any specific damage, waste details, etc."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Taken */}
      <Card>
        <CardHeader>
          <CardTitle>Action Taken</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="noticeServed"
              name="noticeServed"
              checked={formData.noticeServed}
              onChange={handleInputChange}
              className="w-4 h-4"
            />
            <Label htmlFor="noticeServed" className="cursor-pointer">
              Notice Served
            </Label>
          </div>

          {formData.noticeServed && (
            <div>
              <Label htmlFor="noticeType">Notice Type</Label>
              <Input
                id="noticeType"
                name="noticeType"
                value={formData.noticeType}
                onChange={handleInputChange}
                placeholder="e.g., Section 77, Section 78, etc."
              />
            </div>
          )}

          <div>
            <Label htmlFor="departureTime">Departure Time</Label>
            <Input
              type="time"
              id="departureTime"
              name="departureTime"
              value={formData.departureTime}
              onChange={handleInputChange}
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="destinationKnown"
              name="destinationKnown"
              checked={formData.destinationKnown}
              onChange={handleInputChange}
              className="w-4 h-4"
            />
            <Label htmlFor="destinationKnown" className="cursor-pointer">
              Destination Known
            </Label>
          </div>

          {formData.destinationKnown && (
            <div>
              <Label htmlFor="destinationDetails">Destination Details</Label>
              <Input
                id="destinationDetails"
                name="destinationDetails"
                value={formData.destinationDetails}
                onChange={handleInputChange}
                placeholder="Where did they go?"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Police Involvement */}
      <Card>
        <CardHeader>
          <CardTitle>Police Involvement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="policePresent"
              name="policePresent"
              checked={formData.policePresent}
              onChange={handleInputChange}
              className="w-4 h-4"
            />
            <Label htmlFor="policePresent" className="cursor-pointer">
              Police Present
            </Label>
          </div>

          {formData.policePresent && (
            <>
              <div>
                <Label htmlFor="policeForce">Police Force</Label>
                <Input
                  id="policeForce"
                  name="policeForce"
                  value={formData.policeForce}
                  onChange={handleInputChange}
                  placeholder="e.g., Metropolitan Police, Essex Police, etc."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="officerName">Officer Name</Label>
                  <Input
                    id="officerName"
                    name="officerName"
                    value={formData.officerName}
                    onChange={handleInputChange}
                  />
                </div>

                <div>
                  <Label htmlFor="officerNumber">Officer Number</Label>
                  <Input
                    id="officerNumber"
                    name="officerNumber"
                    value={formData.officerNumber}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="incidentNumber">Incident/CAD Number</Label>
                <Input
                  id="incidentNumber"
                  name="incidentNumber"
                  value={formData.incidentNumber}
                  onChange={handleInputChange}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Photos/Evidence */}
      <Card>
        <CardHeader>
          <CardTitle>Photos & Evidence</CardTitle>
          <CardDescription>Upload photos of the site, vehicles, notices served, etc.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="photos" className="cursor-pointer">
              <div className="border-2 border-dashed border-v3-border rounded-lg p-6 text-center hover:border-v3-orange transition-colors">
                <Upload className="mx-auto mb-2 text-v3-text-muted" size={32} />
                <p className="text-v3-text-muted">Click to upload photos</p>
                <p className="text-sm text-v3-text-muted mt-1">or drag and drop</p>
              </div>
            </Label>
            <Input
              type="file"
              id="photos"
              name="photos"
              onChange={handleFileChange}
              multiple
              accept="image/*"
              className="hidden"
            />
          </div>

          {formData.photos.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Uploaded Photos ({formData.photos.length})</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {formData.photos.map((photo, index) => (
                  <div key={index} className="relative group">
                    <div className="aspect-square bg-v3-bg-dark rounded-lg overflow-hidden">
                      <img
                        src={URL.createObjectURL(photo)}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <AlertCircle size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="additionalNotes"
            name="additionalNotes"
            value={formData.additionalNotes}
            onChange={handleInputChange}
            placeholder="Any other relevant information, observations, or details about the eviction..."
            rows={6}
          />
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex gap-4 sticky bottom-0 bg-v3-bg-darkest p-4 border-t border-v3-border">
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          className="flex-1"
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1 bg-v3-orange hover:bg-v3-orange/90"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Submitting...
            </>
          ) : (
            <>
              <CheckCircle size={16} className="mr-2" />
              Submit Report
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default TravellerEvictionForm;
