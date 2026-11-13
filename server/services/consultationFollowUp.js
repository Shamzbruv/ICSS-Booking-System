const templates = {
    lead: {
        subject: 'Let’s turn our consultation into a plan',
        paragraphs: [
            'Thank you for meeting with the ICSS Bookings team. We’d love to help turn what we discussed into a practical plan for your business.',
            'Reply with the outcome you’d like to achieve first and any timing you have in mind. We’ll use that to put together a clear recommendation for the next step.'
        ]
    },
    lost: {
        subject: 'Thank you for meeting with ICSS Bookings',
        paragraphs: [
            'Thank you for making time to speak with us and for sharing what you’re working toward. We appreciated the chance to learn more about your business.',
            'If your plans change or a question comes up down the road, you’re welcome to reply to this email. We wish you all the best with what’s ahead.'
        ]
    }
};

function buildFollowUp(booking, outcome, message = '') {
    const template = typeof outcome === 'string' && Object.hasOwn(templates, outcome) ? templates[outcome] : null;
    if (!template) return null;
    return {
        subject: template.subject,
        paragraphs: [
            `Hi ${booking.client_name},`,
            template.paragraphs[0],
            ...(message ? [message] : []),
            template.paragraphs[1],
            'Best,\nThe ICSS Bookings team'
        ]
    };
}

module.exports = { buildFollowUp };
