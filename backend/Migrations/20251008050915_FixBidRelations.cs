using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AuctionApi.Migrations
{
    /// <inheritdoc />
    public partial class FixBidRelations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Bids_AspNetUsers_BidderId",
                table: "Bids");

            migrationBuilder.AlterColumn<string>(
                name: "BidderId",
                table: "Bids",
                type: "nvarchar(450)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(450)",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Bids_AspNetUsers_BidderId",
                table: "Bids",
                column: "BidderId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Bids_AspNetUsers_BidderId",
                table: "Bids");

            migrationBuilder.AlterColumn<string>(
                name: "BidderId",
                table: "Bids",
                type: "nvarchar(450)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.AddForeignKey(
                name: "FK_Bids_AspNetUsers_BidderId",
                table: "Bids",
                column: "BidderId",
                principalTable: "AspNetUsers",
                principalColumn: "Id");
        }
    }
}
