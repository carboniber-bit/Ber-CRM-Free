import type { Contract } from './contract'
import type { Cents } from '../lib/money'

export type InstallmentStatus = 'pending' | 'partial' | 'paid' | 'overdue'

export interface Installment {
  id: string
  owner_id: string
  contract_id: string
  position: number
  amount_cents: number
  due_date: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface FinancialPayment {
  id: string
  owner_id: string
  contract_id: string
  idempotency_key: string
  related_payment_id: string | null
  type: 'receipt' | 'refund'
  amount_cents: number
  received_at: string
  payment_method: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface PaymentAllocation {
  id: string
  owner_id: string
  contract_id: string
  payment_id: string
  installment_id: string
  amount_cents: number
  created_at: string
}

export interface InstallmentFinancial extends Installment {
  allocated_cents: number
  remaining_cents: number
  status: InstallmentStatus
}

export interface ContractListItem extends Contract {
  client_name: string
}

export interface ContractFinancials {
  contract: ContractListItem
  installments: InstallmentFinancial[]
  payments: FinancialPayment[]
  allocations: PaymentAllocation[]
  receivedCents: number
  pendingCents: number
}

export type ExpenseStatus = 'pending' | 'paid' | 'cancelled'

export interface ExpenseCategory {
  id: string
  owner_id: string
  name: string
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface FinancialExpense {
  id: string
  owner_id: string
  description: string
  category_id: string | null
  amount_cents: number
  expense_date: string
  due_date: string | null
  paid_at: string | null
  payment_method: string | null
  status: ExpenseStatus
  project_id: string | null
  contract_id: string | null
  notes: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export interface ExpenseWrite {
  description: string
  categoryId: string | null
  amountCents: number
  expenseDate: string
  dueDate: string | null
  projectId: string | null
  contractId: string | null
  notes: string
}

export interface ExpenseNotesInput {
  notes: string
}

export interface PaymentInput {
  idempotencyKey: string
  type: FinancialPayment['type']
  amountCents: number
  receivedAt: string
  paymentMethod: string
  notes: string
  relatedPaymentId: string | null
  allocations: Array<{ installmentId: string; amountCents: number }>
}

export interface PaymentResult extends FinancialPayment {
  allocations: PaymentAllocation[]
  already_existed: boolean
}

export interface CreateContractInput {
  creationKey: string
  clientId: string
  service: string
  totalValueCents: Cents
  contractedAt: string
  dueDate: string | null
  paymentMethod: string
  paymentTerms: string
  notes: string
}

export interface InstallmentWrite {
  amountCents: Cents
  dueDate: string
  notes: string
}

export interface UpcomingPayment {
  contract_id: string
  client_id: string
  description: string
  due_date: string
  amount_cents: number
}

export interface FinancialSummary {
  contractedCents: number
  receivedHistoricalCents: number
  pendingCents: number
  periodReceiptsCents: number
  periodExpensesCents: number
  periodProfitCents: number
  overdueCents: number
  overdue: UpcomingPayment[]
  upcoming: UpcomingPayment[]
}

export interface CashFlowBucket {
  label: string
  receiptsCents: number
  expensesCents: number
  netCents: number
  balanceCents: number
}

export type CashFlowGranularity = 'day' | 'week' | 'month' | 'year'

export interface ExpenseCategoryTotal {
  categoryId: string | null
  name: string
  amountCents: number
}
