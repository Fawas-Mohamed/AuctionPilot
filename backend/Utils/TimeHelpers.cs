// Utils/TimeHelpers.cs
using System;

namespace AuctionApi.Utils
{
    public static class TimeHelpers
    {
        /// <summary>
        /// Ensure a DateTime value is stored as UTC.
        /// If incoming.Kind == Unspecified we treat it as Local (browser likely sent local time)
        /// and convert to UTC. Otherwise, convert to UTC.
        /// </summary>
        public static DateTime EnsureUtc(DateTime incoming)
        {
            if (incoming.Kind == DateTimeKind.Unspecified)
            {
                incoming = DateTime.SpecifyKind(incoming, DateTimeKind.Local);
            }
            return incoming.ToUniversalTime();
        }
    }
}
