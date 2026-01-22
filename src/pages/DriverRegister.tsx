import { useState } from 'react';
import { motion } from 'framer-motion';
import { Car, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

const DriverRegister = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    mobileNumber: '',
    todaAssociation: '',
    bodyNumber: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { error } = await supabase.from('drivers').insert({
      full_name: formData.fullName,
      mobile_number: formData.mobileNumber,
      toda_association: formData.todaAssociation,
      body_number: formData.bodyNumber,
      status: 'pending'
    });

    setIsSubmitting(false);
    if (!error) setIsSuccess(true);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-6">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card rounded-2xl p-8 max-w-md text-center">
          <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Application Submitted!</h1>
          <p className="text-muted-foreground">We'll review your application and contact you soon.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="p-6 text-center text-primary-foreground">
        <Car className="w-12 h-12 mx-auto mb-2" />
        <h1 className="text-2xl font-bold">Driver Registration</h1>
        <p className="opacity-80">Join TrikGo as a verified driver</p>
      </header>

      <motion.form onSubmit={handleSubmit} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-card rounded-t-3xl p-6 space-y-4">
        <div><Label>Full Name</Label><Input required value={formData.fullName} onChange={e => setFormData(p => ({...p, fullName: e.target.value}))} /></div>
        <div><Label>Mobile Number</Label><Input required type="tel" placeholder="09XX XXX XXXX" value={formData.mobileNumber} onChange={e => setFormData(p => ({...p, mobileNumber: e.target.value}))} /></div>
        <div><Label>TODA / Association</Label><Input required value={formData.todaAssociation} onChange={e => setFormData(p => ({...p, todaAssociation: e.target.value}))} /></div>
        <div><Label>Tricycle Body Number</Label><Input required value={formData.bodyNumber} onChange={e => setFormData(p => ({...p, bodyNumber: e.target.value}))} /></div>
        <Button type="submit" variant="hero" size="xl" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" /> : 'Submit Application'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">Already registered? <a href="/driver/dashboard" className="text-primary underline">Go to Dashboard</a></p>
      </motion.form>
    </div>
  );
};

export default DriverRegister;