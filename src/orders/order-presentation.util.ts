type OrderPresentationShape = {
  paymentMethod?: string;
  paidAt?: Date | null;
};

export function getPaymentStatus(order: OrderPresentationShape) {
  if (order.paymentMethod === 'cash') {
    return order.paidAt ? 'PAID' : 'CASH';
  }

  return order.paidAt ? 'PAID' : 'PENDING';
}

export function presentOrder<T extends OrderPresentationShape>(order: T) {
  return {
    ...order,
    isPaid: Boolean(order.paidAt),
    paymentStatus: getPaymentStatus(order),
  };
}
