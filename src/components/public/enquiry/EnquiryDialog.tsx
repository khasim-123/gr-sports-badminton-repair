import React from 'react';
import { Dialog } from '../home/Dialog';
import { EnquiryForm, type EnquiryFormProps } from './EnquiryForm';

interface EnquiryDialogProps extends Omit<EnquiryFormProps, 'onDone'> {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  onClose: () => void;
}

/** An enquiry form in a dialog (academy slot, tournament department, custom T-shirts). */
export const EnquiryDialog: React.FC<EnquiryDialogProps> = ({ open, title, description, onClose, ...form }) => (
  <Dialog open={open} onClose={onClose} title={title} description={description} size="lg">
    {/* Keyed so a different academy or department starts with an empty form. */}
    <EnquiryForm key={`${form.kind}-${form.fixed?.academyId || form.fixed?.department || ''}`} {...form} onDone={onClose} />
  </Dialog>
);
