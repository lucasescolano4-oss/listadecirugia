import React, { useState, useEffect } from 'react';

function Clock() {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const formatTime = (date) => {
        return date.toLocaleTimeString('es-AR', { hour12: false });
    };

    return (
        <div className="global-clock no-print">
            {formatTime(time)}
        </div>
    );
}

export default Clock;
